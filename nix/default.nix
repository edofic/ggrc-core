let pkgs = import <nixpkgs> {};

in

{
   bowerComponents = pkgs.callPackage ./bower-generated.nix {};
}
