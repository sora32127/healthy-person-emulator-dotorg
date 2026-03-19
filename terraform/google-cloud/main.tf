terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6"
    }
  }

  backend "gcs" {
    bucket = "hpe-terraform-state-gcp"
    prefix = "terraform/state"
  }
}

# GOOGLE_APPLICATION_CREDENTIALS 環境変数から自動読み込み
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}
