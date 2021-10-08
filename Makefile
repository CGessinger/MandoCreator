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

pictures: images/Helmets.svg images/Female.svg images/Male.svg images/Logo.svg images/Background.svg images/Mouse-Droid.svg
	touch pictures

images:
	mkdir -p images

images/%.svg: pictures/%.svg | images
	sed -E " : top \
		/>/ ! { \
			N; \
			b top; \
		}; \
		s/(^|\s)\s+/\1/g; \
		s/_(F|M)([^[:lower:]])/\2/; \
		/Toggle/ { \
			s|_Toggle|\" class=\"toggle|; \
			s|Off|\" style=\"display:none|; \
		}; \
		s|_Option|\" class=\"option|; \
		/\"Chest\"/ { \
			s/ / class=\"swappable\" /; \
		}; \
	" $< > $@;

#=========================GALLERY=========================

MALE=$(wildcard gallery/male/*.svg)
FEMALE=$(wildcard gallery/female/*.svg)
RAW=$(patsubst gallery/male/%,gallery/raw/%,$(MALE))

gallery: $(RAW) gallery/wrapper_male.svg gallery/wrapper_female.svg
	touch $@;

wrapper_%.svg: $(RAW)
	echo $@;
	echo "<?xml version='1.0' encoding='UTF-8' standalone='no'?><!DOCTYPE svg PUBLIC '-//W3C//DTD SVG 1.1//EN' 'http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd'><svg version='1.1' xmlns='http://www.w3.org/2000/svg'>" > $@;
	for i in $(notdir $(wildcard $*/*)); do \
		sed " \
			1D; \
		" $*/$$i >> $@; done;
	echo "</svg>" >> $@;

gallery/raw/%: gallery/male/% gallery/female/% | gallery/raw
	echo $@;
	echo 
	sed " \
		/<meta/ ! { d; }; \
		/.<meta/ { \
			s|.\+<meta|<?xml version='1.0' encoding='UTF-8'?><svg version='1.1' xmlns='http://www.w3.org/2000/svg'>\n<meta|; \
			P; \
			D; \
		}; \
		: top \
		/^<meta/ { \
			N; \
			s|\n[[:space:]]*\n|\n|g; \
			b top; \
		} \
	" $<;

gallery/raw:
	mkdir -p $@;
