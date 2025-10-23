#!/bin/bash
set -e

# Create separate databases for each nwaku node
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE nwaku1;
    CREATE DATABASE nwaku2;
EOSQL
