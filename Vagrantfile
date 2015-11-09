# -*- mode: ruby -*-
# vi: set ft=ruby :

# Copyright (C) 2013 Google Inc., authors, and contributors <see AUTHORS file>
# Licensed under http://www.apache.org/licenses/LICENSE-2.0 <see LICENSE file>
# Created By: dan@reciprocitylabs.com
# Maintained By: dan@reciprocitylabs.com

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/trusty64"

  # If you are installing repeatedly, you can download the box from the above
  # link and use this local `box_url` instead:
  # config.vm.box_url = "precise64.box"

  # Create a private network, which allows host-only access to the machine
  # using a specific IP.
  config.vm.network :private_network, ip: "192.168.33.10"

  # Forward ports used in Flask/AppEngine development
  config.vm.network :forwarded_port, guest: 8080, host: 8080, host_ip: "127.0.0.1"
  config.vm.network :forwarded_port, guest: 8000, host: 8000, host_ip: "127.0.0.1"
  config.vm.network :forwarded_port, guest: 3306, host: 3306, host_ip: "127.0.0.1"
  config.vm.network :forwarded_port, guest: 9876, host: 9876, host_ip: "127.0.0.1"

  # Provider-specific configuration so you can fine-tune various
  # backing providers for Vagrant. These expose provider-specific options.
  # Example for VirtualBox:
  #
  config.vm.provider :virtualbox do |vb|
    # Use VBoxManage to customize the VM. For example to change memory:
    vb.customize ["modifyvm", :id, "--memory", "1024"]
  end
  #
  # View the documentation for the provider you're using for more
  # information on available options.
  config.vm.provision :ansible do |ansible|
    ansible.playbook = "provision/site.yml"
    ansible.host_key_checking = false
  end
end
