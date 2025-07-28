const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { FabricCAServices, FabricCAClient } = require('fabric-ca-client');
const { Gateway, Wallets } = require('fabric-network');
const forge = require('node-forge');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Schemas (unchanged)
const userRequestSchema = new mongoose.Schema({
  name: String,
  surname: String,
  role: String,
  orgDomain: String,
  email: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  enrollmentId: String,
  secret: String,
  createdAt: { type: Date, default: Date.now }
});
const UserRequest = mongoose.model('UserRequest', userRequestSchema);

const chaincodeSubmissionSchema = new mongoose.Schema({
  chaincodeName: String,
  version: String,
  file: String,
  submittedBy: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvals: [{ org: String, approved: Boolean }],
  createdAt: { type: Date, default: Date.now }
});
const ChaincodeSubmission = mongoose.model('ChaincodeSubmission', chaincodeSubmissionSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Fabric Configuration
const ccpPath = path.join(__dirname, '../bevel-operator-fabric/examples/client/nodejs/connection-org.yaml');
const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));
const walletPath = path.join(__dirname, 'wallet');
const wallet = await Wallets.newFileSystemWallet(walletPath);

// Email Transporter (unchanged)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Authentication Middleware (unchanged)
const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.enrollmentId !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const authenticateUser = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.decode(token);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes (adjusted to use env variable for CA URL)
app.post('/api/register', async (req, res) => {
  const { name, surname, role, orgDomain, email } = req.body;
  try {
    const userRequest = new UserRequest({ name, surname, role, orgDomain, email });
    await userRequest.save();
    res.status(201).json({ message: 'Registration request submitted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit request' });
  }
});

app.get('/api/admin/requests', authenticateAdmin, async (req, res) => {
  try {
    const requests = await UserRequest.find({ status: 'pending' });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.post('/api/admin/approve/:id', authenticateAdmin, async (req, res) => {
  try {
    const request = await UserRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const enrollmentId = `user_${Date.now()}`;
    const secret = Math.random().toString(36).substring(2, 15);

    const caURL = process.env.FABRIC_CA_URL; // Configurable via .env
    const caClient = new FabricCAClient(caURL, null, '');
    const adminIdentity = await wallet.get('admin');
    await caClient.register({
      enrollmentID: enrollmentId,
      enrollmentSecret: secret,
      role: 'client',
      affiliation: `${request.orgDomain}.department1`,
      attrs: [{ name: 'role', value: request.role, ecert: true }]
    }, adminIdentity);

    request.enrollmentId = enrollmentId;
    request.secret = secret;
    request.status = 'approved';
    await request.save();

    const enrollmentLink = `http://localhost:3000/enroll?enrollmentId=${enrollmentId}&secret=${secret}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: request.email,
      subject: 'Complete Your Enrollment',
      html: `<p>Please complete your enrollment:</p><p><strong>Enrollment ID:</strong> ${enrollmentId}</p><p><strong>Secret:</strong> ${secret}</p><p><a href="${enrollmentLink}">Click here to enroll</a></p>`
    });

    res.json({ message: 'User approved and enrollment email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve request: ' + error.message });
  }
});

app.post('/api/enroll', async (req, res) => {
  const { enrollmentId, secret, password } = req.body;
  try {
    const caURL = process.env.FABRIC_CA_URL; // Configurable via .env
    const caClient = new FabricCAClient(caURL, null, '');
    const enrollment = await caClient.enroll({ enrollmentID: enrollmentId, enrollmentSecret: secret });
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
      forge.pki.privateKeyFromPem(enrollment.key.toString()),
      [forge.pki.certificateFromPem(enrollment.certificate)],
      password,
      { algorithm: '3des' }
    );
    const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
    const p12Base64 = Buffer.from(p12Der, 'binary').toString('base64');
    await wallet.put(enrollmentId, {
      credentials: {
        certificate: enrollment.certificate,
        privateKey: enrollment.key.toString()
      }
    });
    res.json({ certificate: p12Base64 });
  } catch (error) {
    res.status(500).json({ error: 'Enrollment failed: ' + error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { certificate } = req.body;
  try {
    const cert = forge.pki.certificateFromPem(certificate);
    if (!cert.isValid) return res.status(401).json({ error: 'Invalid certificate' });
    const enrollmentId = cert.subject.getField('CN').value;
    const token = jwt.sign({ enrollmentId, role: cert.getAttribute('role')?.value }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

app.post('/api/share', authenticateUser, async (req, res) => {
  const { channelName, chaincodeName, bundle, roles } = req.body;
  try {
    const gateway = new Gateway();
    await gateway.connect(ccp, {
      wallet,
      identity: req.user.enrollmentId,
      discovery: { enabled: true, asLocalhost: false } // Kubernetes environment
    });
    const network = await gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);
    const encryptedData = Buffer.from(bundle).toString('base64'); // Encrypt client-side or server-side
    await contract.submitTransaction('StoreCTI', req.user.enrollmentId, encryptedData, JSON.stringify(roles));
    await gateway.disconnect();
    res.json({ message: 'CTI shared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to share CTI: ' + error.message });
  }
});

app.get('/api/bundles', authenticateUser, async (req, res) => {
  const { startKey = '', limit = 10 } = req.query;
  try {
    const gateway = new Gateway();
    await gateway.connect(ccp, {
      wallet,
      identity: req.user.enrollmentId,
      discovery: { enabled: true, asLocalhost: false }
    });
    const network = await gateway.getNetwork(process.env.CHANNEL_NAME);
    const contract = network.getContract(process.env.CHAINCODE_NAME);
    const result = await contract.evaluateTransaction('ListCTIs', startKey, limit.toString());
    await gateway.disconnect();
    res.json(JSON.parse(result.toString()));
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve CTI bundles: ' + error.message });
  }
});

app.get('/api/bundle/:id', authenticateUser, async (req, res) => {
  try {
    const gateway = new Gateway();
    await gateway.connect(ccp, {
      wallet,
      identity: req.user.enrollmentId,
      discovery: { enabled: true, asLocalhost: false }
    });
    const network = await gateway.getNetwork(process.env.CHANNEL_NAME);
    const contract = network.getContract(process.env.CHAINCODE_NAME);
    const result = await contract.evaluateTransaction('RetrieveCTI', req.params.id);
    await gateway.disconnect();
    res.json(JSON.parse(result.toString()));
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve CTI: ' + error.message });
  }
});

app.post('/api/submit-chaincode', authenticateUser, async (req, res) => {
  const { chaincodeName, version, file } = req.body;
  try {
    const submission = new ChaincodeSubmission({
      chaincodeName,
      version,
      file,
      submittedBy: req.user.enrollmentId,
      approvals: []
    });
    await submission.save();
    res.status(201).json({ message: 'Chaincode submitted for approval' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit chaincode: ' + error.message });
  }
});

app.post('/api/approve-chaincode/:id', authenticateAdmin, async (req, res) => {
  try {
    const submission = await ChaincodeSubmission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    submission.approvals.push({ org: req.user.org, approved: true });
    if (submission.approvals.filter(a => a.approved).length >= 2) {
      submission.status = 'approved';
      // Placeholder for Bevel Operator chaincode deployment (needs manual integration)
      console.log('Chaincode approved, deploy via Bevel Operator k8s/ manifests');
    }
    await submission.save();
    res.json({ message: 'Chaincode approval updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve chaincode: ' + error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));