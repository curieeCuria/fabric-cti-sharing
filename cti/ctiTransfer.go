// SPDX-License-Identifier: Apache-2.0
// Portions of this code are adapted from assetTransfer.go, licensed under Apache 2.0.
// See https://github.com/hyperledger/fabric-samples/blob/main/asset-transfer-basic/chaincode-external/assetTransfer.go for the original implementation.

package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strconv"

	"github.com/hyperledger/fabric-chaincode-go/shim"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type serverConfig struct {
	CCID    string
	Address string
}

type CTIChaincode struct {
	contractapi.Contract
}

type CTIMetadata struct {
	UUID           string   `json:"UUID"`
	Description    string   `json:"Description"`
	Timestamp      string   `json:"Timestamp"`
	SenderIdentity string   `json:"SenderIdentity"`
	CID            string   `json:"CID"`
	VaultKey       string   `json:"VaultKey"`
	SHA256Hash     string   `json:"SHA256Hash"`
	AccessList     []string `json:"AccessList"`
}

func (c *CTIChaincode) InitLedger(ctx contractapi.TransactionContextInterface) error {
	initialMetadata := []CTIMetadata{
		{
			UUID:           "12345",
			Description:    "Initial metadata entry 12345",
			Timestamp:      "2023-10-01T12:00:00Z",
			SenderIdentity: "user1",
			CID:            "CID12345",
			VaultKey:       "vaultKey12345",
			SHA256Hash:     "sha256hash12345",
			AccessList:     []string{"HeadOfOperations", "IntelligenceUnit"},
		},
		{
			UUID:           "67890",
			Description:    "Initial metadata entry 67890",
			Timestamp:      "2023-10-02T12:00:00Z",
			SenderIdentity: "user2",
			CID:            "CID67890",
			VaultKey:       "vaultKey67890",
			SHA256Hash:     "sha256hash67890",
			AccessList:     []string{"TacticalUnit"},
		},
	}

	for _, metadata := range initialMetadata {
		metadataKey := fmt.Sprintf("CTI_%s", metadata.UUID)
		metadataBytes, err := json.Marshal(metadata)
		if err != nil {
			return fmt.Errorf("failed to marshal metadata: %v", err)
		}

		err = ctx.GetStub().PutState(metadataKey, metadataBytes)
		if err != nil {
			return fmt.Errorf("failed to put state for metadata %s: %v", metadata.UUID, err)
		}
	}
	return nil
}

func (c *CTIChaincode) CreateCTIMetadata(ctx contractapi.TransactionContextInterface, metadataJSON string) error {
	var metadata CTIMetadata
	err := json.Unmarshal([]byte(metadataJSON), &metadata)
	if err != nil {
		return fmt.Errorf("failed to unmarshal metadata: %v", err)
	}

	if metadata.UUID == "" || metadata.Description == "" || metadata.Timestamp == "" ||
		metadata.SenderIdentity == "" || metadata.CID == "" || metadata.VaultKey == "" || metadata.SHA256Hash == "" {
		return fmt.Errorf("all fields in metadata must be non-empty")
	}

	// Check access control, only roles "HeadOfOperations", "IntelligenceUnit" and "SpecialOperationsUnit" can create CTI metadata
	clientRole, found, err := ctx.GetClientIdentity().GetAttributeValue("role")
	if err != nil {
		return fmt.Errorf("failed to get client role: %v", err)
	}
	if !found {
		return fmt.Errorf("client role not found")
	}
	if clientRole != "HeadOfOperations" && clientRole != "IntelligenceUnit" && clientRole != "SpecialOperationsUnit" {
		return fmt.Errorf("client role %s is not authorized to create CTI metadata", clientRole)
	}

	metadataKey := fmt.Sprintf("CTI_%s", metadata.UUID)
	exists, err := ctx.GetStub().GetState(metadataKey)
	if err != nil {
		return fmt.Errorf("failed to check if metadata exists: %v", err)
	}
	if exists != nil {
		return fmt.Errorf("metadata with UUID %s already exists", metadata.UUID)
	}

	metadataBytes, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %v", err)
	}

	return ctx.GetStub().PutState(metadataKey, metadataBytes)
}

func (c *CTIChaincode) GetAllCTI(ctx contractapi.TransactionContextInterface) ([]CTIMetadata, error) {
	iter, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer iter.Close()

	var metadataList []CTIMetadata
	for iter.HasNext() {
		queryResponse, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate over state: %v", err)
		}

		var metadata CTIMetadata
		err = json.Unmarshal(queryResponse.Value, &metadata)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal metadata: %v", err)
		}
		metadataList = append(metadataList, metadata)
	}

	return metadataList, nil
}

func (c *CTIChaincode) ReadCTIMetadata(ctx contractapi.TransactionContextInterface, uuid string) (*CTIMetadata, error) {
	metadataKey := fmt.Sprintf("CTI_%s", uuid)
	metadataBytes, err := ctx.GetStub().GetState(metadataKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read metadata from world state: %v", err)
	}
	if metadataBytes == nil {
		return nil, fmt.Errorf("metadata with UUID %s does not exist", uuid)
	}

	var metadata CTIMetadata
	err = json.Unmarshal(metadataBytes, &metadata)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal metadata: %v", err)
	}

	// Check access control, "HeadOfOperations" and "SpecialOperationsUnit" can always read CTI metadata
	// "TactialUnit" can only read metadata if AccessList contains "TacticalUnit"
	clientRole, found, err := ctx.GetClientIdentity().GetAttributeValue("role")
	if err != nil {
		return nil, fmt.Errorf("failed to get client role: %v", err)
	}
	if !found {
		return nil, fmt.Errorf("client role not found")
	}
	if clientRole == "TacticalUnit" {
		for _, role := range metadata.AccessList {
			if role == "TacticalUnit" {
				return &metadata, nil
			}
		}
		return nil, fmt.Errorf("client role %s is not authorized to read CTI metadata with UUID %s", clientRole, uuid)
	}
	if clientRole != "HeadOfOperations" && clientRole != "SpecialOperationsUnit" {
		return nil, fmt.Errorf("client role %s is not authorized to read CTI metadata with UUID %s", clientRole, uuid)
	}

	return &metadata, nil
}

func (c *CTIChaincode) UpdateCTIMetadata(ctx contractapi.TransactionContextInterface, metadataJSON string) error {
	var metadata CTIMetadata
	err := json.Unmarshal([]byte(metadataJSON), &metadata)
	if err != nil {
		return fmt.Errorf("failed to unmarshal metadata: %v", err)
	}

	metadataKey := fmt.Sprintf("CTI_%s", metadata.UUID)
	exists, err := ctx.GetStub().GetState(metadataKey)
	if err != nil {
		return fmt.Errorf("failed to check if metadata exists: %v", err)
	}
	if exists == nil {
		return fmt.Errorf("metadata with UUID %s does not exist", metadata.UUID)
	}

	metadataBytes, err := json.Marshal(metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %v", err)
	}

	return ctx.GetStub().PutState(metadataKey, metadataBytes)
}

func (c *CTIChaincode) DeleteCTIMetadata(ctx contractapi.TransactionContextInterface, uuid string) error {
	metadataKey := fmt.Sprintf("CTI_%s", uuid)
	exists, err := ctx.GetStub().GetState(metadataKey)
	if err != nil {
		return fmt.Errorf("failed to check if metadata exists: %v", err)
	}
	if exists == nil {
		return fmt.Errorf("metadata with UUID %s does not exist", uuid)
	}

	return ctx.GetStub().DelState(metadataKey)
}

func main() {
	config := serverConfig{
		CCID:    os.Getenv("CHAINCODE_ID"),
		Address: os.Getenv("CHAINCODE_SERVER_ADDRESS"),
	}

	chaincode, err := contractapi.NewChaincode(new(CTIChaincode))

	if err != nil {
		log.Panicf("Error creating CTIChaincode: %s", err)
	}

	server := &shim.ChaincodeServer{
		CCID:     config.CCID,
		Address:  config.Address,
		CC:       chaincode,
		TLSProps: getTLSProperties(),
	}

	if err := server.Start(); err != nil {
		log.Panicf("Error starting CTIChaincode: %s", err)
	}
}

func getTLSProperties() shim.TLSProperties {
	tlsDisabledStr := getEnvOrDefault("CHAINCODE_TLS_DISABLED", "true")
	key := getEnvOrDefault("CHAINCODE_TLS_KEY", "")
	cert := getEnvOrDefault("CHAINCODE_TLS_CERT", "")
	clientCACert := getEnvOrDefault("CHAINCODE_CLIENT_CA_CERT", "")

	tlsDisabled := getBoolOrDefault(tlsDisabledStr, false)
	var keyBytes, certBytes, clientCACertBytes []byte
	var err error

	if !tlsDisabled {
		keyBytes, err = os.ReadFile(key)
		if err != nil {
			log.Panicf("Error reading TLS key file: %s", err)
		}

		certBytes, err = os.ReadFile(cert)
		if err != nil {
			log.Panicf("Error reading TLS cert file: %s", err)
		}

		clientCACertBytes, err = os.ReadFile(clientCACert)
		if err != nil {
			log.Panicf("Error reading client CA cert file: %s", err)
		}
	}

	if clientCACert != "" {
		clientCACertBytes, err = os.ReadFile(clientCACert)
		if err != nil {
			log.Panicf("Error reading client CA cert file: %s", err)
		}
	}

	return shim.TLSProperties{
		Disabled:      tlsDisabled,
		Key:           keyBytes,
		Cert:          certBytes,
		ClientCACerts: clientCACertBytes,
	}
}

func getEnvOrDefault(env, defaultVal string) string {
	value, ok := os.LookupEnv(env)
	if !ok {
		value = defaultVal
	}
	return value
}

func getBoolOrDefault(value string, defaultVal bool) bool {
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return defaultVal
	}
	return parsed
}
