terraform {
  required_version = ">= 1.9.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "8.10.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.9.1"
    }
  }

  backend "gcs" {
    bucket = "cis437-project-514314-tfstate"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.default_region
  zone    = var.default_zone
}


