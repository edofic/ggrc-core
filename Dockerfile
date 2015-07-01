FROM phusion/baseimage
ADD . /vagrant

RUN add-apt-repository -y ppa:chris-lea/node.js \
 && apt-get update \
 && export DEBIAN_FRONTEND=noninteractive \
 && apt-get install -y curl git-core python-pip mysql-server zip unzip vim make python-virtualenv fabric python-mysqldb python-imaging sqlite3 python-dev ruby nodejs wget \
 && mkdir -p /vagrant-dev/opt \
 && mkdir -p /vagrant-dev/tmp \
 && mkdir -p /vagrant/tmp \
 && cd /vagrant \
 && make setup_dev DEV_PREFIX=/vagrant-dev \
 && gem install sass -v 3.2.13 \
 && gem install compass -v 0.12.2 \
 && npm install -g nodeunit pegjs karma-cli jasmine-core mkdirp \
 && npm install karma karma-jasmine \
 && make appengine DEV_PREFIX=/vagrant-dev \
 && cd /var/lib && mv mysql mysql-hd && ln -s mysql-hd mysql \
 && /etc/init.d/mysql start \
 && mysqladmin -u root password root \
 && echo "create database ggrcdev; create database ggrctest" | mysql -uroot -proot \
 && /etc/init.d/mysql stop \
 && cp /vagrant/provision/docker/01_start_mysql.sh /etc/my_init.d/ \
 && chmod +x /etc/my_init.d/01_start_mysql.sh \
 && useradd -G sudo -m vagrant \
 && echo "vagrant ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers \
 && cat /vagrant/provision/roles/ggrc/templates/.bashrc.j2 > /home/vagrant/.bashrc \
 && cd / && rm -rf /vagrant && mkdir /vagrant \
 && chown -R vagrant.vagrant /vagrant*


CMD /sbin/my_init
EXPOSE 8000 8080 9876
