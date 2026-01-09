# PR Template (Minimal)

## PR Goal (one sentence)
Default CLI init success copy to the hosted dashboard URL.

## Commit Narrative
- change(cli): default dashboard url to https://www.vibeusage.cc
- test(init): cover default dashboard url when not configured
- docs(pr): record regression command and result

## Regression Test Gate
### Most likely regression surface
- CLI init success copy and dashboard link output.

### Verification method (choose at least one)
- [x] `node --test test/init-flow-copy.test.js -t "init defaults dashboard url when not configured"` => PASS

### Uncovered scope
- Full CLI init run with browser auth in a real environment.
