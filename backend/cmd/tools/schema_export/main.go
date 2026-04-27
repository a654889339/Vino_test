package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/go-sql-driver/mysql"

	dbbase "shared/dbbase"
)

func envOr(k, def string) string {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		return v
	}
	return def
}

func main() {
	var project = flag.String("project", "vino", "project name for yaml")
	var out = flag.String("out", "", "output yaml path (default: ../common/config/db/<project>.schema.columns.yaml)")
	flag.Parse()

	host := envOr("DB_HOST", "127.0.0.1")
	port := envOr("DB_PORT", "3306")
	user := envOr("DB_USER", "root")
	pass := envOr("DB_PASS", envOr("DB_PASSWORD", ""))
	dbname := envOr("DB_NAME", *project)

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=true&loc=Local", user, pass, host, port, dbname)
	sqlDB, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer sqlDB.Close()

	doc, err := dbbase.ExportInformationSchemaColumns(*project, sqlDB)
	if err != nil {
		log.Fatalf("export information_schema: %v", err)
	}

	outPath := *out
	if strings.TrimSpace(outPath) == "" {
		outPath = filepath.Join("..", "common", "config", "db", *project+".schema.columns.yaml")
	}
	if err := dbbase.WriteSchemaColumnsYAML(outPath, doc); err != nil {
		log.Fatalf("write yaml: %v", err)
	}
	log.Printf("OK wrote %s (tables=%d)", outPath, len(doc.Tables))
}
