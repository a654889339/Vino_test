package services

import "vino/backend/internal/config"

func SendSMSCode(cfg *config.Config, phone string) error {
	return phoneVerifyService(cfg).SendSMSCode(phone)
}
