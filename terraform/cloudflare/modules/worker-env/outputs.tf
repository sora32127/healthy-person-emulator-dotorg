output "d1_database_id" {
  value = cloudflare_d1_database.db.id
}

output "worker_script_name" {
  value = cloudflare_workers_script.worker.script_name
}
