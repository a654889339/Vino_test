package cosbase

import (
	"testing"
	"time"
)

func TestSafeDatabaseDirSegment(t *testing.T) {
	if SafeDatabaseDirSegment("app_db") != "app_db" {
		t.Fatal()
	}
	if SafeDatabaseDirSegment("bad/../x") != "_invalid" {
		t.Fatal()
	}
}

func TestValidateBackupObjectKey(t *testing.T) {
	if err := ValidateBackupObjectKey("db_save/app/2024-01-02/09.sql.gz"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateBackupObjectKey("log/backend/hour.json"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateBackupObjectKey("other/prefix/x"); err == nil {
		t.Fatal("expected error")
	}
	if err := ValidateBackupObjectKey("db_save/../x"); err == nil {
		t.Fatal("expected error")
	}
}

func TestFormatDbSaveHourlyKey(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	h := time.Date(2024, 3, 9, 9, 30, 0, 0, loc)
	got := FormatDbSaveHourlyKey("melamine", h, loc)
	want := "db_save/melamine/2024-03-09/09.sql.gz"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestSanitizeStatTypeSegment(t *testing.T) {
	if SanitizeStatTypeSegment("Admin/Product") != "admin_product" {
		t.Fatal(SanitizeStatTypeSegment("Admin/Product"))
	}
	if SanitizeStatTypeSegment("") != "misc" {
		t.Fatal()
	}
}

func TestFormatLogBackendObjectKey(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	h := time.Date(2026, 4, 25, 12, 0, 0, 0, loc)
	key := FormatLogBackendObjectKey(h, loc, "backend_2026-04-25-12.log")
	want := "log/backend/2026-04-25/backend_2026-04-25-12.log"
	if key != want {
		t.Fatalf("got %q want %q", key, want)
	}
	if err := ValidateBackupObjectKey(key); err != nil {
		t.Fatal(err)
	}
}

func TestFormatLogStatObjectKey(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Shanghai")
	h := time.Date(2026, 4, 25, 12, 0, 0, 0, loc)
	key := FormatLogStatObjectKey("Admin/Product", h, loc, "stat_admin_product_2026-04-25-12.log")
	want := "log/stat/admin_product/2026-04-25/stat_admin_product_2026-04-25-12.log"
	if key != want {
		t.Fatalf("got %q want %q", key, want)
	}
	if err := ValidateBackupObjectKey(key); err != nil {
		t.Fatal(err)
	}
}
