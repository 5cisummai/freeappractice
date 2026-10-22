# AP Art History reference data

The [CSV](./ap-art-history-250-image-set.csv) contains the 250 required works, checked against College Board’s current CED on 2026-10-21, including Fall 2026 corrections.

Official sources:

- [Course and Exam Description](https://apcentral.collegeboard.org/media/pdf/ap-art-history-course-and-exam-description.pdf): Appendix 1 identifiers and official reference images.
- [Fall 2026 corrections](https://apcentral.collegeboard.org/media/pdf/ap-art-history-course-and-exam-description-clarifications.pdf).

`college_board_source` links to each work’s Appendix page. `image_source` links to its first official image-set page; `official_image_set_pages` lists all PDF pages and `image_count` counts the views. No image files are stored in this project.

Locations follow College Board’s identifiers: 111 are specified and 139 are not. Blank artist/culture fields reflect absent identifiers. Museum locations were not added. Era notation is normalized to B.C.E. / C.E.

`identifier_notes` flags the apparent College Board error “Babylon (modern Iran)” for #19 while preserving its wording. `image_view_notes` records corrected captions and #199’s six actual views despite the CED header saying five.
