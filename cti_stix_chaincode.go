// File: cti_stix_chaincode.go

package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// ──────────────────────────────────────────────────────────────────────────────
// 1) Contract definition
// ──────────────────────────────────────────────────────────────────────────────

// CTIStixContract implements the Fabric Contract Interface
type CTIStixContract struct {
	contractapi.Contract
}

// ──────────────────────────────────────────────────────────────────────────────
// 2) STIX 2.1 Object Structs
// ──────────────────────────────────────────────────────────────────────────────

// Indicator represents a STIX 2.1 “indicator” object
type Indicator struct {
	Type               string              `json:"type"`         // must be "indicator"
	ID                 string              `json:"id"`           // e.g. "indicator--UUID"
	SpecVersion        string              `json:"spec_version"` // must be "2.1"
	Created            string              `json:"created"`      // e.g. "2025-05-01T12:15:00Z"
	Modified           string              `json:"modified"`     // e.g. "2025-05-01T12:15:00Z"
	Name               string              `json:"name"`
	Description        string              `json:"description"`
	Pattern            string              `json:"pattern"`      // e.g. "[ipv4-addr:value = '203.0.113.45']"
	PatternType        string              `json:"pattern_type"` // e.g. "stix"
	ValidFrom          string              `json:"valid_from"`   // e.g. "2025-05-01T00:00:00Z"
	Labels             []string            `json:"labels"`       // e.g. ["c2-server","malware-c2"]
	Confidence         int                 `json:"confidence"`   // e.g. 75
	ExternalReferences []ExternalReference `json:"external_references"`
}

// Relationship represents a STIX 2.1 “relationship” object
type Relationship struct {
	Type             string `json:"type"`              // must be "relationship"
	ID               string `json:"id"`                // e.g. "relationship--UUID"
	SpecVersion      string `json:"spec_version"`      // "2.1"
	Created          string `json:"created"`           // e.g. "2025-05-01T12:20:00Z"
	Modified         string `json:"modified"`          // e.g. "2025-05-01T12:20:00Z"
	RelationshipType string `json:"relationship_type"` // e.g. "indicates"
	SourceRef        string `json:"source_ref"`        // e.g. "indicator--…"
	TargetRef        string `json:"target_ref"`        // e.g. "malware--…"
}

// Sighting represents a STIX 2.1 “sighting” object
type Sighting struct {
	Type             string   `json:"type"`               // must be "sighting"
	ID               string   `json:"id"`                 // e.g. "sighting--UUID"
	SpecVersion      string   `json:"spec_version"`       // "2.1"
	Created          string   `json:"created"`            // e.g. "2025-05-02T08:30:00Z"
	Modified         string   `json:"modified"`           // e.g. "2025-05-02T08:30:00Z"
	FirstSeen        string   `json:"first_seen"`         // e.g. "2025-05-02T07:45:00Z"
	LastSeen         string   `json:"last_seen"`          // e.g. "2025-05-02T08:00:00Z"
	Count            int      `json:"count"`              // e.g. 3
	SightingOfRef    string   `json:"sighting_of_ref"`    // e.g. "indicator--…"
	WhereSightedRefs []string `json:"where_sighted_refs"` // e.g. ["identity--…"]
}

// Bundle represents a STIX 2.1 “bundle” object, containing multiple STIX objects
type Bundle struct {
	Type        string            `json:"type"`         // must be "bundle"
	ID          string            `json:"id"`           // e.g. "bundle--UUID"
	SpecVersion string            `json:"spec_version"` // "2.1"
	Objects     []json.RawMessage `json:"objects"`      // an array of raw JSON for each STIX object
}

// ExternalReference is used by Indicator (and potentially other objects)
type ExternalReference struct {
	SourceName string `json:"source_name"`
	URL        string `json:"url"`
}

// ──────────────────────────────────────────────────────────────────────────────
// 3) Utility Methods
// ──────────────────────────────────────────────────────────────────────────────

// putAsset helper function to write any JSON-marshaled object into world state
func (c *CTIStixContract) putAsset(ctx contractapi.TransactionContextInterface, id string, assetJSON []byte) error {
	return ctx.GetStub().PutState(id, assetJSON)
}

// getAsset helper function to read any object by ID from world state
func (c *CTIStixContract) getAsset(ctx contractapi.TransactionContextInterface, id string) ([]byte, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return nil, fmt.Errorf("failed to read %s from world state: %v", id, err)
	}
	if data == nil {
		return nil, fmt.Errorf("asset %s does not exist", id)
	}
	return data, nil
}

// assetExists checks if a key already exists in world state
func (c *CTIStixContract) assetExists(ctx contractapi.TransactionContextInterface, id string) (bool, error) {
	data, err := ctx.GetStub().GetState(id)
	if err != nil {
		return false, fmt.Errorf("failed to read %s from world state: %v", id, err)
	}
	return data != nil, nil
}

// getAllAssets returns all JSON objects stored in world state (unfiltered)
func (c *CTIStixContract) getAllAssets(ctx contractapi.TransactionContextInterface) ([]json.RawMessage, error) {
	iterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer iterator.Close()

	var results []json.RawMessage
	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate: %v", err)
		}
		results = append(results, queryResponse.Value)
	}
	return results, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// 4) Indicator Methods
// ──────────────────────────────────────────────────────────────────────────────

// CreateIndicator writes a new STIX Indicator into world state
func (c *CTIStixContract) CreateIndicator(
	ctx contractapi.TransactionContextInterface,
	jsonStr string,
) error {
	// jsonStr is expected to be a JSON string representing the full Indicator object
	var ind Indicator
	if err := json.Unmarshal([]byte(jsonStr), &ind); err != nil {
		return fmt.Errorf("failed to parse indicator JSON: %v", err)
	}

	// Ensure the “type” field is correct
	if ind.Type != "indicator" {
		return fmt.Errorf("asset type must be 'indicator', got '%s'", ind.Type)
	}

	// Check if this ID already exists
	exists, err := c.assetExists(ctx, ind.ID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("indicator with ID %s already exists", ind.ID)
	}

	// Marshal back to JSON (ensuring consistent formatting) and store
	bytes, err := json.Marshal(ind)
	if err != nil {
		return fmt.Errorf("failed to marshal indicator for storage: %v", err)
	}
	return c.putAsset(ctx, ind.ID, bytes)
}

// ReadIndicator retrieves a single Indicator by its STIX ID
func (c *CTIStixContract) ReadIndicator(
	ctx contractapi.TransactionContextInterface,
	id string,
) (*Indicator, error) {
	bytes, err := c.getAsset(ctx, id)
	if err != nil {
		return nil, err
	}

	var ind Indicator
	if err := json.Unmarshal(bytes, &ind); err != nil {
		return nil, fmt.Errorf("failed to unmarshal indicator JSON: %v", err)
	}
	return &ind, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// 5) Relationship Methods
// ──────────────────────────────────────────────────────────────────────────────

// CreateRelationship writes a new STIX Relationship into world state
func (c *CTIStixContract) CreateRelationship(ctx contractapi.TransactionContextInterface, jsonStr string) error {
	var rel Relationship
	if err := json.Unmarshal([]byte(jsonStr), &rel); err != nil {
		return fmt.Errorf("failed to parse relationship JSON: %v", err)
	}

	if rel.Type != "relationship" {
		return fmt.Errorf("asset type must be 'relationship', got '%s'", rel.Type)
	}

	exists, err := c.assetExists(ctx, rel.ID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("relationship with ID %s already exists", rel.ID)
	}

	bytes, err := json.Marshal(rel)
	if err != nil {
		return fmt.Errorf("failed to marshal relationship for storage: %v", err)
	}
	return c.putAsset(ctx, rel.ID, bytes)
}

// ReadRelationship retrieves a single Relationship by its STIX ID
func (c *CTIStixContract) ReadRelationship(
	ctx contractapi.TransactionContextInterface,
	id string,
) (*Relationship, error) {
	bytes, err := c.getAsset(ctx, id)
	if err != nil {
		return nil, err
	}

	var rel Relationship
	if err := json.Unmarshal(bytes, &rel); err != nil {
		return nil, fmt.Errorf("failed to unmarshal relationship JSON: %v", err)
	}
	return &rel, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// 6) Sighting Methods
// ──────────────────────────────────────────────────────────────────────────────

// CreateSighting writes a new STIX Sighting into world state
func (c *CTIStixContract) CreateSighting(ctx contractapi.TransactionContextInterface, jsonStr string) error {
	var sit Sighting
	if err := json.Unmarshal([]byte(jsonStr), &sit); err != nil {
		return fmt.Errorf("failed to parse sighting JSON: %v", err)
	}

	if sit.Type != "sighting" {
		return fmt.Errorf("asset type must be 'sighting', got '%s'", sit.Type)
	}

	exists, err := c.assetExists(ctx, sit.ID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("sighting with ID %s already exists", sit.ID)
	}

	bytes, err := json.Marshal(sit)
	if err != nil {
		return fmt.Errorf("failed to marshal sighting for storage: %v", err)
	}
	return c.putAsset(ctx, sit.ID, bytes)
}

// ReadSighting retrieves a single Sighting by its STIX ID
func (c *CTIStixContract) ReadSighting(
	ctx contractapi.TransactionContextInterface,
	id string,
) (*Sighting, error) {
	bytes, err := c.getAsset(ctx, id)
	if err != nil {
		return nil, err
	}

	var sit Sighting
	if err := json.Unmarshal(bytes, &sit); err != nil {
		return nil, fmt.Errorf("failed to unmarshal sighting JSON: %v", err)
	}
	return &sit, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// 7) Bundle Methods
// ──────────────────────────────────────────────────────────────────────────────

// CreateBundle writes a new STIX Bundle into world state
func (c *CTIStixContract) CreateBundle(ctx contractapi.TransactionContextInterface, jsonStr string) error {
	var b Bundle
	if err := json.Unmarshal([]byte(jsonStr), &b); err != nil {
		return fmt.Errorf("failed to parse bundle JSON: %v", err)
	}

	if b.Type != "bundle" {
		return fmt.Errorf("asset type must be 'bundle', got '%s'", b.Type)
	}

	exists, err := c.assetExists(ctx, b.ID)
	if err != nil {
		return err
	}
	if exists {
		return fmt.Errorf("bundle with ID %s already exists", b.ID)
	}

	// We keep the “Objects” field as an array of Raw JSON; no need to validate every sub-object here
	bytes, err := json.Marshal(b)
	if err != nil {
		return fmt.Errorf("failed to marshal bundle for storage: %v", err)
	}
	return c.putAsset(ctx, b.ID, bytes)
}

// ReadBundle retrieves a single Bundle by its STIX ID
func (c *CTIStixContract) ReadBundle(
	ctx contractapi.TransactionContextInterface,
	id string,
) (*Bundle, error) {
	bytes, err := c.getAsset(ctx, id)
	if err != nil {
		return nil, err
	}

	var b Bundle
	if err := json.Unmarshal(bytes, &b); err != nil {
		return nil, fmt.Errorf("failed to unmarshal bundle JSON: %v", err)
	}
	return &b, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// 8) Generic “Get All” Method
// ──────────────────────────────────────────────────────────────────────────────

// GetAllObjects returns a JSON array of all stored STIX objects (Indicator, Relationship,
// Sighting, Bundle, or any other JSON‐blobs) in the world state.
func (c *CTIStixContract) GetAllObjects(
	ctx contractapi.TransactionContextInterface,
) ([]json.RawMessage, error) {
	allData, err := c.getAllAssets(ctx)
	if err != nil {
		return nil, err
	}
	return allData, nil
}

// GetAllObjects returns a single JSON array containing all stored STIX objects.
func (c *CTIStixContract) GetAllObjects2(
	ctx contractapi.TransactionContextInterface,
) ([]byte, error) {
	iterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer iterator.Close()

	// Collect all world‐state values (each is raw JSON already)
	var allData []json.RawMessage
	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate: %v", err)
		}
		allData = append(allData, queryResponse.Value)
	}

	// Marshal the slice of RawMessage into one JSON array (of objects)
	resultBytes, err := json.Marshal(allData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal allData to JSON: %v", err)
	}
	return resultBytes, nil
}

// GetAllObjects2 returns a Go‐slice of RawMessage,
// which Fabric ContractAPI will marshal into a JSON array of objects.
func (c *CTIStixContract) GetAllObjects3(
	ctx contractapi.TransactionContextInterface,
) ([]json.RawMessage, error) {
	iterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer iterator.Close()

	// Each queryResponse.Value is already a []byte containing valid JSON for one object
	var allData []json.RawMessage
	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate: %v", err)
		}
		allData = append(allData, queryResponse.Value)
	}

	// Return the slice. ContractAPI will automatically JSON‐marshal it as:
	//   [ { …first object… }, { …second object… }, … ]
	return allData, nil
}

// GetAllObjects returns a true JSON array of objects by returning a slice of generic maps.
func (c *CTIStixContract) GetAllObjects4(
	ctx contractapi.TransactionContextInterface,
) ([]interface{}, error) {
	iterator, err := ctx.GetStub().GetStateByRange("", "")
	if err != nil {
		return nil, fmt.Errorf("failed to get state by range: %v", err)
	}
	defer iterator.Close()

	var allData []interface{}
	for iterator.HasNext() {
		queryResponse, err := iterator.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to iterate: %v", err)
		}
		// Unmarshal each world‐state value (which is []byte JSON) into a generic map
		var obj map[string]interface{}
		if err := json.Unmarshal(queryResponse.Value, &obj); err != nil {
			return nil, fmt.Errorf("failed to unmarshal world‐state value: %v", err)
		}
		allData = append(allData, obj)
	}

	// Return the slice of maps. ContractAPI will JSON‐marshal it as [ {...}, {...} ]
	return allData, nil
}

// ──────────────────────────────────────────────────────────────────────────────
// 9) Main: Chaincode Start
// ──────────────────────────────────────────────────────────────────────────────

func main() {
	chaincode, err := contractapi.NewChaincode(&CTIStixContract{})
	if err != nil {
		fmt.Printf("Error creating CTI STIX chaincode: %v\n", err)
		return
	}
	if err := chaincode.Start(); err != nil {
		fmt.Printf("Error starting CTI STIX chaincode: %v\n", err)
	}
}
