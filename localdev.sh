#!/bin/bash

until docker info;
    do sleep 1;
done;
touch .env
npx supabase start
npx supabase status | awk '/API URL/ {print "SUPABASE_URL="$NF} /anon key/ {print "SUPABASE_ANON_KEY="$NF} /service_role key/ {print "SUPABASE_SERVICE_ROLE_KEY="$NF} /DB URL/ {print "SUPABASE_CONNECTION_STRING="$NF}' > .env
npm run reset:db
npm run seed
npm run dev
