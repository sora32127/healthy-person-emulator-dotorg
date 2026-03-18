terraform {
  required_version = ">= 1.5.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5"
    }
  }

  backend "s3" {
    bucket                      = "hpe-terraform-state"
    key                         = "terraform.tfstate"
    region                      = "auto"
    endpoint                    = "https://9ecb9a8692f7c2c5c56387d93a9a1e60.r2.cloudflarestorage.com"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    force_path_style            = true
  }
}

# CLOUDFLARE_API_TOKEN 環境変数から自動読み込み
provider "cloudflare" {}
