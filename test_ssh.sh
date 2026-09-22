#!/usr/bin/expect -f
spawn ssh -o StrictHostKeyChecking=no root@supabase.buildstart.io "ls -la /root/supabase/supabase/docker"
expect "password:"
send "2jAm38abeNBLA27HbGeP\r"
expect eof
