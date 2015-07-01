#!/bin/bash

cd /
mkdir /ram
mount -t tmpfs -o size=2G none /ram
if [ $? -eq 0 ]; then
  mkdir /ram/mysql
  rsync -aSx /var/lib/mysql-hd/. /ram/mysql/.
  cd /var/lib
  rm mysql
  ln -s /ram/mysql
  (
    while true; do
      sleep 300
      rsync -aSx /ram/mysql/. /var/lib/mysql-hd/.
    done
  ) &
else
  rmdir /ram
fi

/etc/init.d/mysql start
