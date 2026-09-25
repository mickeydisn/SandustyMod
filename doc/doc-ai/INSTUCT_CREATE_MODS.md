

# Create a new mod instruction : 

- Start with a clean mod directory : use `./mods-dev/md-admin-clean` as pattern.
- Search on `./doc/doc-tech` for tech referance , and `./doc/doc-artifacts` as game api referance
- Search for feature in `./mods-*/README.md` to find existing code in the repo
- use `./packages/mysandkit` as api interface, `./packages/shared`, `./packages/modkit`, as referance . if need update , add a `src/packages/` directory in you mod update can be made one day .. also if the mode create can use a generic package for their feature it must be add in the mod directly . 

- Also use https://sandustry.com/sandkit.html  as absolut reference for sandkit api. 