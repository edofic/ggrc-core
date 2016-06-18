{ fetchbower, buildEnv }:
buildEnv { name = "bower-env"; ignoreCollisions = true; paths = [
  (fetchbower "canjs" "2.0.7" "2.0.7" "0pclc5j3lfr1virvc283h4j3k3y0yjpphaq074xnzhr92q3r5483")
  (fetchbower "bootstrap" "2.0.4" "2.0.4" "1kfhr56swcybk4pbdbvckjpjadi6nx2411lcmw6nfkyd4wx27yf1")
  (fetchbower "jquery-ui" "1.11.4" "1.11.4" "18zl7jhki6amsdd9bxbwx2q5hl8f0i39bbq4snskjrq1hm6if3ka")
  (fetchbower "jquery" "1.11.3" "1.11.3" "1b4rk5gs51ak0vhf6z4p6lpympgp9z03c9mxz8r8bi5d2vdb9n7p")
  (fetchbower "lodash" "3.10.1" "3.10.1" "065g9pfhbrc4lni27ddsyvwa62xzjpndv2pr3ydc3ky3rmk6y4xj")
  (fetchbower "mousetrap" "1.5.3" "1.5.3" "0karpxv8xn4z1sbcaxvvbz45lhvab6kjlfhil90vwiq6risagg0z")
  (fetchbower "moment" "2.10.6" "2.10.6" "10mhzdmdz73iyhbih5i32xhmydw2sv3dqiq7g8cy9wijry9lnb02")
  (fetchbower "moment-timezone" "0.5.0" "0.5.0" "0g3dc4593ar6igq9jzkxgni6a0rx10ba24y75dwsxglynxiz2q1c")
  (fetchbower "jasmine-fixture" "1.3.3" "1.3.3" "070vgn289nfak365k3p487bj8nlzdsm9mmp07qhb124ga0s75jpr")
  (fetchbower "spinjs" "1.3.3" "1.3.3" "0n37fmz08jv8vnkraqj9rphfr327viw5ildf1wh4da60sprygh84")
  (fetchbower "fontawesome" "4.4.0" "~4.4.0" "1mbs0vhixvg11vj3n0l3jn3pb6s839rcs416zq2wzfqkbvsc3sf5")
  (fetchbower "string-natural-compare" "1.1.1" "1.1.1" "1sib4pnbqdpbx9kbzwkz2lfyz9jaxc8011ynxf5wax3kdsmhm3h2")
  (fetchbower "quill" "0.20.1" "~0.20.1" "1r7p0gnbhn836nriw8560198zll46c6725dxwgjhmwx344qqgyc9")
  (fetchbower "zeroclipboard" "2.2.0" "~2.2.0" "1b2kv5nm0l7nsl4ailm3rzjl0gqmg4ni7dzf2qvh8krmg8aa25mq")
]; }
