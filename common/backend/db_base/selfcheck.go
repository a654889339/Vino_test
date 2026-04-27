package dbbase

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// SelfCheckMysqldump validates runtime requirements for the configured mode.
// It MUST NOT print secrets.
func SelfCheckMysqldump(mode, containerName string) error {
	m := strings.TrimSpace(strings.ToLower(mode))
	if m == "" {
		m = "docker"
	}
	if m != "docker" && m != "local" {
		return fmt.Errorf("mysqldump.mode must be docker|local, got %q", mode)
	}
	if m == "docker" {
		if _, err := os.Stat("/var/run/docker.sock"); err != nil {
			return fmt.Errorf("mysqldump.mode=docker but /var/run/docker.sock missing: %v", err)
		}
		if _, err := exec.LookPath("docker"); err != nil {
			return fmt.Errorf("mysqldump.mode=docker but docker CLI missing: %v", err)
		}
		if strings.TrimSpace(containerName) == "" && strings.TrimSpace(os.Getenv("MYSQL_DUMP_CONTAINER")) == "" {
			return fmt.Errorf("mysqldump.mode=docker but container name missing (mysqldump.container_name or MYSQL_DUMP_CONTAINER)")
		}
		return nil
	}
	if _, err := exec.LookPath("mysqldump"); err != nil {
		return fmt.Errorf("mysqldump.mode=local but mysqldump missing: %v", err)
	}
	return nil
}

