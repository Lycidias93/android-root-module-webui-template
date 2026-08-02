.PHONY: verify build clean

verify:
	./scripts/verify.sh

build:
	./scripts/build.sh

clean:
	rm -rf build dist update.json
