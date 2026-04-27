package dbbase

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
)

// DumpParams mysqldump 所需连接与容器（与 R-Melamine / Vino 行为对齐）。
type DumpParams struct {
	Host          string
	Port          int
	User          string
	Password      string
	DBName        string
	Mode          string // docker|local; empty => docker
	ContainerName string // docker exec 容器名；空则尝试 MYSQL_DUMP_CONTAINER 环境变量
}

// DumpLogical 仅导出 DBName 这一库（--databases 单库）。
// 按 Mode 强制 docker exec 或本机 mysqldump。
func DumpLogical(ctx context.Context, p DumpParams) (stdout []byte, stderr string, err error) {
	mode := strings.TrimSpace(strings.ToLower(p.Mode))
	if mode == "" {
		mode = "docker"
	}
	dumpArgs := []string{
		"-u" + p.User,
		"--single-transaction",
		"--routines",
		"--events",
		"--set-gtid-purged=OFF",
		"--databases",
		p.DBName,
	}
	container := strings.TrimSpace(p.ContainerName)
	if container == "" {
		container = strings.TrimSpace(os.Getenv("MYSQL_DUMP_CONTAINER"))
	}

	if mode == "docker" {
		if _, statErr := os.Stat("/var/run/docker.sock"); statErr != nil {
			return nil, "", fmt.Errorf("mysqldump.mode=docker 但未找到 /var/run/docker.sock（请挂载 docker.sock）: %v", statErr)
		}
		if _, lookErr := exec.LookPath("docker"); lookErr != nil {
			return nil, "", fmt.Errorf("mysqldump.mode=docker 但未找到 docker CLI: %v", lookErr)
		}
		if container == "" {
			return nil, "", fmt.Errorf("未配置 mysqldump 容器名：请在 YAML mysqldump.container_name 或环境变量 MYSQL_DUMP_CONTAINER 中设置")
		}
		args := append([]string{
			"exec",
			"-e", "MYSQL_PWD=" + p.Password,
			container,
			"mysqldump",
		}, dumpArgs...)
		cmd := exec.CommandContext(ctx, "docker", args...)
		var outB, errB bytes.Buffer
		cmd.Stdout = &outB
		cmd.Stderr = &errB
		err = cmd.Run()
		return outB.Bytes(), strings.TrimSpace(errB.String()), err
	}

	// local mode
	if _, e := exec.LookPath("mysqldump"); e != nil {
		return nil, "", fmt.Errorf("未找到 docker 且未找到 mysqldump：请挂载 /var/run/docker.sock 并安装 docker CLI，或安装 mysql-client")
	}
	args := append([]string{
		"-h" + p.Host,
		"-P" + fmt.Sprintf("%d", p.Port),
	}, dumpArgs...)
	cmd := exec.CommandContext(ctx, "mysqldump", args...)
	var env []string
	for _, e := range os.Environ() {
		if strings.HasPrefix(e, "MYSQL_PWD=") {
			continue
		}
		env = append(env, e)
	}
	cmd.Env = append(env, "MYSQL_PWD="+p.Password)
	var outB, errB bytes.Buffer
	cmd.Stdout = &outB
	cmd.Stderr = &errB
	err = cmd.Run()
	return outB.Bytes(), strings.TrimSpace(errB.String()), err
}
