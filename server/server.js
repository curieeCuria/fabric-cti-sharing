const express = require('express');
const { Gateway, Wallets } = require('fabric-network');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const CCP_PATH = process.env.CCP_PATH || path.join(__dirname, 'connection-org.yaml');
const WALLET_PATH = process.env.WALLET_PATH || path.join(__dirname, 'wallet');
const USER_ID = process.env.USER_ID || 'appUser';
const CHANNEL = process.env.CHANNEL || 'mychannel';
const CC_NAME = process.env.CHAINCODE || 'cti';

async function submit(functionName, ...args) {
  const ccp = yaml.load(fs.readFileSync(CCP_PATH, 'utf8'));
  const wallet = await Wallets.newFileSystemWallet(WALLET_PATH);
  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: USER_ID,
    discovery: { enabled: true, asLocalhost: false }
  });
  try {
    const network = await gateway.getNetwork(CHANNEL);
    const contract = network.getContract(CC_NAME);
    const result = await contract.submitTransaction(functionName, ...args);
    return result.toString();
  } finally {
    gateway.disconnect();
  }
}

const app = express();
app.use(express.json());

app.post('/api/indicator', async (req, res) => {
  try {
    await submit('CreateIndicator', JSON.stringify(req.body));
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/relationship', async (req, res) => {
  try {
    await submit('CreateRelationship', JSON.stringify(req.body));
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/sighting', async (req, res) => {
  try {
    await submit('CreateSighting', JSON.stringify(req.body));
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/bundle', async (req, res) => {
  try {
    await submit('CreateBundle', JSON.stringify(req.body));
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/objects', async (req, res) => {
  try {
    const result = await submit('GetAllObjects2');
    res.json(JSON.parse(result));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
