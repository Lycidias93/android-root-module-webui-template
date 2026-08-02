.PHONY: verify build clean core-plan core-apply

verify:
	./scripts/verify.sh

build:
	./scripts/build.sh

clean:
	rm -rf build dist update.json

core-plan:
	@test -n "$(TARGET)" || { echo "Set TARGET=/path/to/repository"; exit 2; }
	./scripts/sync-core.sh "$(TARGET)"

core-apply:
	@test -n "$(TARGET)" || { echo "Set TARGET=/path/to/repository"; exit 2; }
	./scripts/sync-core.sh --apply "$(TARGET)"
