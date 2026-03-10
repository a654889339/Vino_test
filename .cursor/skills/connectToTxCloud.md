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
- **Note**: Requires `sudo` to access /root directory

## Docker Operations
```bash
# Check containers
ssh ... ubuntu@106.54.50.88 "sudo docker ps --filter 'name=vino'"

# Rebuild and restart
ssh ... ubuntu@106.54.50.88 "sudo bash -c 'cd /root/Vino_test && docker compose down && docker compose up -d --build'"

# View logs
ssh ... ubuntu@106.54.50.88 "sudo docker logs vino-backend"
ssh ... ubuntu@106.54.50.88 "sudo docker logs vino-frontend"
ssh ... ubuntu@106.54.50.88 "sudo docker logs vino-mysql"
```

## Port Allocation (避免冲突)
| 项目 | 前端 | 后端 | 数据库 |
|------|------|------|--------|
| ItsyourTurnMy | 5001 | 5002 / 8080 | 3306 |
| ItsyourTurnRing | 5101 | 5102 | 3307 |
| **Vino_test** | **5201** | **5202** | **3308** |

## Important Notes
1. The server has network issues accessing GitHub directly - use SCP to transfer files
2. Always use `sudo` when accessing files in `/root/`
3. SSH options are required for RSA key compatibility
4. Container names use `vino-` prefix to avoid conflicts with other projects
