module shared/dbbase

go 1.25.0

require (
	github.com/go-sql-driver/mysql v1.8.1
	gopkg.in/yaml.v3 v3.0.1
	shared/cosbase v0.0.0
)

require (
	filippo.io/edwards25519 v1.1.0 // indirect
	github.com/aliyun/aliyun-oss-go-sdk v2.2.7+incompatible // indirect
	github.com/clbanning/mxj v1.8.4 // indirect
	github.com/google/go-querystring v1.0.0 // indirect
	github.com/kr/pretty v0.3.1 // indirect
	github.com/mitchellh/mapstructure v1.4.3 // indirect
	github.com/mozillazg/go-httpheader v0.2.1 // indirect
	github.com/tencentyun/cos-go-sdk-v5 v0.7.47 // indirect
	golang.org/x/time v0.15.0 // indirect
)

replace shared/cosbase => ../cos_base
