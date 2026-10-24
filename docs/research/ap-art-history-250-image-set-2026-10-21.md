# AP Art History reference data

The [CSV](./ap-art-history-250-image-set.csv) contains the 250 required works, checked against College Board’s current CED on 2026-10-21, including Fall 2026 corrections.

Official sources:

- [Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-art-history-course-and-exam-description.pdf): Appendix 1 identifiers and official reference images.
- [Fall 2026 corrections](https://apcentral.collegeboard.org/media/pdf/ap-art-history-course-and-exam-description-clarifications.pdf).

`image_source` is a public, direct image URL suitable for an HTML image element. All 406 exact College Board reference images are hosted in the separate Vercel Blob store `ap-art-history-reference-images`; no image files are stored in this project. The [hosted image index](https://9shs7umfqlbmbtqw.public.blob.vercel-storage.com/ap-art-history/2026-27/images.json) lists every view for all 250 works, in source reading order, with its PDF page and file hash. The CSV uses the first view for each work. All 406 URLs were anonymously downloaded and verified against the exact source-image bytes on 2026-10-22.

`college_board_source` links to each work’s Appendix page. `official_image_set_pages` lists all image-set PDF pages and `image_count` counts the views. Source-image credits and rights remain applicable; hosting does not change them.

Locations follow College Board’s identifiers: 111 are specified and 139 are not. Blank artist/culture fields reflect absent identifiers. Museum locations were not added. Era notation is normalized to B.C.E. / C.E.

`identifier_notes` flags the apparent College Board error “Babylon (modern Iran)” for #19 while preserving its wording. `image_view_notes` records corrected captions and #199’s six actual views despite the CED header saying five.
