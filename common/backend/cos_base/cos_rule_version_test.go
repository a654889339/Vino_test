package cosbase

import "testing"

func TestCosRuleConfigVersion(t *testing.T) {
	SetCosRuleConfigVersion(7)
	if CosRuleConfigVersion() != 7 {
		t.Fatalf("expected 7, got %d", CosRuleConfigVersion())
	}
	SetCosRuleConfigVersion(0)
}
