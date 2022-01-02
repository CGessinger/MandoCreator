default: release

ifndef VERBOSE
.SILENT:
endif

release: gallery pictures

serve: release
	python -m http.server --bind 0.0.0.0

clean:
	rm -rf images;
	rm gallery/wrapper_*.svg
	rm -rf gallery/raw
.PHONY: clean

#=========================IMAGES==========================

pictures: images/Helmets.svg images/Female.svg images/Male.svg images/Logo.svg images/Background.svg images/Mouse-Droid.svg images/Decals.svg
	touch pictures

images:
	mkdir -p images

images/%.svg: pictures/%.svg | images
	sed -E " : top \
		/>/ ! { N; b top; }; \
		s/(^|\s)\s+/\1/g; \
		s/_(F|M)([^[:lower:]])/\2/; \
		/Toggle/ { \
			s|_Toggle|\" class=\"toggle|; \
			s|Off|\" style=\"display:none|; \
		}; \
		s|_Option|\" class=\"option|; \
		s|(\w+)Decals|&\" mask=\"url(#\1Mask)|; \
		/Visor/ { \
			s| | fill=\"#000000\" |; \
		}; \
		/\"Chest\"/ { \
			s/ / class=\"swappable\" /; \
		}; \
	" $< > $@;

#=========================GALLERY=========================

MALE=$(wildcard gallery/male/*.svg)
FEMALE=$(wildcard gallery/female/*.svg)
RAW=$(patsubst gallery/male/%,gallery/raw/%,$(MALE))

gallery: $(RAW)
	touch $@;

gallery/raw/%: gallery/male/% gallery/female/% | gallery/raw
	echo $@;
	sed " \
		s|[[:space:]]d=[\"'][^\"']*[\"']||; \
		/<\w\+\/>/ { d; }; \
	" $< > $@;

gallery/raw:
	mkdir -p $@;
