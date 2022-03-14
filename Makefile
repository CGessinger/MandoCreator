default: release

ifndef VERBOSE
.SILENT:
endif

release: pictures

serve: release
	python -m http.server --bind 0.0.0.0

clean:
	rm -rf images;
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
