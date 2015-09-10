FROM phusion/baseimage
ADD . /ggrc


RUN add-apt-repository -y ppa:chris-lea/node.js \
 && apt-get update \
 && export DEBIAN_FRONTEND=noninteractive \
 && apt-get install -y curl git-core python-pip mysql-server zip unzip vim sqlite3 python-dev python-mysqldb python-imaging ruby nodejs wget \
 && mkdir -p /ggrc/tmp \
 && mkdir -p /ggrc-dev \
 && cd /ggrc-dev \
 && wget https://commondatastorage.googleapis.com/appengine-sdks/deprecated/193/google_appengine_1.9.3.zip  -nv \
 && unzip google_appengine_1.9.3.zip \
 && rm google_appengine_1.9.3.zip \
 && cd /ggrc \
 && pip install -r src/requirements.txt \
 && pip install -r src/dev-requirements.txt \
 && pip install google-api-python-client webob virtualenv\
 && gem install sass --version "=3.2.13" \
 && gem install compass --version "=0.12.2" \
 && npm install karma karma-jasmine jasmine-core phantomjs karma-chrome-launcher \
 && cd /var/lib && mv mysql mysql-hd && ln -s mysql-hd mysql \
 && /etc/init.d/mysql start \
 && echo "create database ggrcdev; create database ggrctest" | mysql -uroot \
 && mysqladmin -u root password root \
 && /etc/init.d/mysql stop \
 && cp /ggrc/provision/docker/01_start_mysql.sh /etc/my_init.d/ \
 && chmod +x /etc/my_init.d/01_start_mysql.sh \
 && cat /ggrc/provision/docker/.bashrc > ~/.bashrc \
 && cd / && rm -rf /ggrc && mkdir /ggrc

CMD /sbin/my_init
EXPOSE 8000 8080 9876
