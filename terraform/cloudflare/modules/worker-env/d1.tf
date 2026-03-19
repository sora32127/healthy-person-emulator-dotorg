resource "cloudflare_d1_database" "db" {
  account_id = var.account_id
  name       = var.d1_name

  read_replication = {
    mode = "disabled"
  }
}
