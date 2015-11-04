FROM phusion/baseimage
ADD . /vagrant

WORKDIR /vagrant

RUN apt-get update && apt-get install -y ansible python-apt python-pycurl wget

RUN useradd -G sudo -m vagrant \
 && echo "vagrant ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers \
 && chown -R vagrant.vagrant . \
 && rm /usr/sbin/policy-rc.d

RUN su vagrant -c "ansible-playbook -i provision/docker/inventory provision/site.yml"

RUN /etc/init.d/mysql stop \
 && cd /var/lib && mv mysql mysql-hd && ln -s mysql-hd mysql \
 && cp /vagrant/provision/docker/01_start_mysql.sh /etc/my_init.d/ \
 && chmod +x /etc/my_init.d/01_start_mysql.sh

RUN rm -rf /vagrant \
 && mkdir /vagrant \
 && chown vagrant.vagrant /vagrant
