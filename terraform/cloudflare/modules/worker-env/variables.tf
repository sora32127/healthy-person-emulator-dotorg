variable "account_id" { type = string }
variable "zone_id" { type = string }

variable "worker_name" {
  description = "Worker script name (e.g. healthy-person-emulator-dotorg)"
  type        = string
}

variable "d1_name" {
  description = "D1 database name"
  type        = string
}

variable "queue_name" {
  description = "Queue base name (DLQ is {queue_name}-dlq)"
  type        = string
}

variable "base_url" {
  description = "BASE_URL for the environment"
  type        = string
}

variable "hostname" {
  description = "Custom domain hostname"
  type        = string
}

variable "cron_schedules" {
  description = "Cron trigger schedules (empty = no crons)"
  type        = list(object({ cron = string }))
  default     = []
}

# 共有リソースへの参照
variable "r2_static_bucket_name" { type = string }
variable "r2_parquet_bucket_name" { type = string }
variable "secrets_store_id" {
  type    = string
  default = "52f3d1be601046039169fad4f66570d1"
}
