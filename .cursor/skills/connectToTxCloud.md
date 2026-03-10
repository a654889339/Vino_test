# Skill: Connect to Tencent Cloud Server (Vino服务)

## Connection Details
- **IP**: 106.54.50.88
- **Port**: 22
- **User**: ubuntu
- **Key**: `F:/ItsyourTurnMy/backend/deploy/test.pem`

## SSH Command
```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i F:/ItsyourTurnMy/backend/deploy/test.pem ubuntu@106.54.50.88
```

## Execute Remote Command
```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i F:/ItsyourTurnMy/backend/deploy/test.pem ubuntu@106.54.50.88 "<command>"
```

## Execute Command as Root
```bash
ssh -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i F:/ItsyourTurnMy/backend/deploy/test.pem ubuntu@106.54.50.88 "sudo bash -c '<command>'"
```

## SCP File Transfer
```bash
# Upload file to server
scp -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i F:/ItsyourTurnMy/backend/deploy/test.pem <local_file> ubuntu@106.54.50.88:<remote_path>

# Download file from server
scp -o HostKeyAlgorithms=+ssh-rsa -o PubkeyAcceptedKeyTypes=+ssh-rsa -o StrictHostKeyChecking=no -i F:/ItsyourTurnMy/backend/deploy/test.pem ubuntu@106.54.50.88:<remote_file> <local_path>
```

## Project Location on Server
- **Path**: `/root/Vino_test`
- **GitHub Repo**: `https://github.com/a654889339/Vino_test`
- **Note**: Requires `sudo` to access /root directory

## Deployment Flow (Git Clone)

### First-time deployment
```bash
# 1. Local: push code to GitHub
git push origin main

# 2. SSH to server and clone via mirror (server cannot access GitHub directly)
ssh ... ubuntu@106.54.50.88 "sudo bash -c 'cd /root && git clone https://ghfast.top/https://github.com/a654889339/Vino_test.git Vino_test'"

# 3. Build and start containers
ssh ... ubuntu@106.54.50.88 "sudo bash -c 'cd /root/Vino_test && docker-compose up -d --build'"
```

### Update deployment (pull latest code)
```bash
# 1. Local: push code to GitHub
git push origin main

# 2. SSH to server and pull latest via mirror
ssh ... ubuntu@106.54.50.88 "sudo git -C /root/Vino_test pull"

# 3. Rebuild and restart containers
ssh ... ubuntu@106.54.50.88 "sudo bash -c 'cd /root/Vino_test && docker compose down && docker compose up -d --build'"
```

## GitHub Mirror Configuration
- Server cannot access GitHub directly; use `ghfast.top` as a mirror proxy
- Remote URL on server: `https://ghfast.top/https://github.com/a654889339/Vino_test.git`
- Already configured via: `git remote set-url origin https://ghfast.top/https://github.com/a654889339/Vino_test.git`

## Docker Operations
```bash
# Check containers
ssh ... ubuntu@106.54.50.88 "sudo docker ps --filter 'name=vino'"

# Rebuild and restart (use docker-compose v1 on this server)
ssh ... ubuntu@106.54.50.88 "sudo bash -c 'cd /root/Vino_test && docker compose down && docker compose up -d --build'"

# View logs
ssh ... ubuntu@106.54.50.88 "sudo docker logs vino-backend"
ssh ... ubuntu@106.54.50.88 "sudo docker logs vino-frontend"
ssh ... ubuntu@106.54.50.88 "sudo docker logs vino-mysql"

# Health check
ssh ... ubuntu@106.54.50.88 "curl -s http://localhost:5202/api/health"
```

## Port Allocation (避免冲突)
| 项目 | 前端 | 后端 | 数据库 |
|------|------|------|--------|
| ItsyourTurnMy | 5001 | 5002 / 8080 | 3306 |
| ItsyourTurnRing | 5101 | 5102 | 3307 |
| **Vino_test** | **5201** | **5202** | **3308** |

## Important Notes
1. Server now has `docker compose` v2 (use `docker compose`, the old `docker-compose` v1 has compatibility issues)
2. Server cannot access GitHub directly - git remote is configured to use `ghfast.top` mirror
3. Always use `sudo` when accessing files in `/root/`
4. SSH options are required for RSA key compatibility
5. Container names use `vino-` prefix to avoid conflicts with other projects
