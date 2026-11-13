# Flanr — Software Requirements Specification

| Field | Value |
|---|---|
| Document | Software Requirements Specification (SRS) |
| Product | Flanr |
| Version | 0.9 |
| Status | Draft |
| Author | Andrii Malyshkin |
| Date | 2026-11-11 |
| Source documents | CONCEPT.md |

## Revision history

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-11-09 | A. Malyshkin | Initial template |
| 0.2 | 2026-11-09 | A. Malyshkin | First full draft based on the concept document |
| 0.3 | 2026-11-10 | A. Malyshkin | Lived-in cities, rating colour scale, monthly city data import, staged rollout, product renamed to Flanr |
| 0.4 | 2026-11-10 | A. Malyshkin | Resolved OI-002 (Geoapify localities extract) and OI-003 (settlements without a boundary are imported as points) |
| 0.5 | 2026-11-10 | A. Malyshkin | OI-002 revised: Geofabrik OSM extracts instead of Geoapify localities |
| 0.6 | 2026-11-11 | A. Malyshkin | Cities that are part of a municipality (BR-001, BR-017, Municipality entity), population made optional, external map links (FR-CITY-009), city districts for later (FR-CITY-010), OI-020 and OI-021 |
| 0.7 | 2026-11-11 | A. Malyshkin | First-level region made optional for countries without regions (Monaco, Vatican City); the capital of a country is always a city (BR-001) |
| 0.8 | 2026-11-12 | A. Malyshkin | Resolved OI-005 (a rating is deleted with the last visit, BR-005), OI-007 (suggested rating rounds halves up, BR-007), OI-010 (username rules, FR-PROF-001) and OI-019 (lived-in periods, BR-016) |
| 0.9 | 2026-11-13 | A. Malyshkin | FR-LIST-001 brought in line with BR-004: the Visited list also has the lived-in cities |

---

## 0. Document conventions

### 0.1 Structure

This document follows the structure of ISO/IEC/IEEE 29148 (Software Requirements Specification), the successor of IEEE 830. Functional requirements are grouped by feature area.

### 0.2 Requirement keywords

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** are to be interpreted as described in RFC 2119.

### 0.3 Requirement identifiers

| Type | Format | Example |
|---|---|---|
| Functional requirement | `FR-<AREA>-<NNN>` | `FR-VIS-001` |
| Non-functional requirement | `NFR-<AREA>-<NNN>` | `NFR-SEC-001` |
| Business rule | `BR-<NNN>` | `BR-003` |
| Constraint | `CON-<NNN>` | `CON-001` |
| Open issue | `OI-<NNN>` | `OI-007` |

IDs are never reused. A removed requirement keeps its ID with status `Deprecated`.

### 0.4 Priority

| Priority | Meaning |
|---|---|
| Must | Required for the release it is assigned to |
| Should | Important, may be moved to the next release |
| Could | Nice to have |
| Won't (now) | Explicitly out of scope for now, kept for reference |

### 0.5 Release

| Release | Meaning |
|---|---|
| MVP | First usable web version |
| R2 | Next release after MVP: social features, photos, moderation |
| Later | Not scheduled |

### 0.6 Status

`Draft` → `Agreed` → `Implemented` → `Verified`, or `Deprecated`.

### 0.7 Requirement template

Every requirement is written in the following form:

> #### FR-XXX-000 — Short title
> **Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Section
>
> **Description.** One requirement per item, written with an RFC 2119 keyword.
>
> **Rationale.** Why the requirement exists. *(optional)*
>
> **Acceptance criteria.**
> 1. Given …, when …, then ….
>
> **Related.** IDs of related requirements, business rules or open issues. *(optional)*

Acceptance criteria are mandatory for requirements assigned to the MVP. Requirements for R2 and Later receive acceptance criteria when they are scheduled.

---

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for Flanr. It is the reference for design, implementation and testing, and the basis for the diploma documentation, which is written separately in the university's required format.

### 1.2 Scope

Flanr is a web application, with a mobile application planned later, for tracking and rating visited settlements. Users log visits to cities, rate cities by several criteria, organise cities into lists, explore their travel history on a world map and in statistics, and see the ratings and activity of other users.

Flanr does not sell or book travel itself. It may show affiliate offers from third-party travel services.

This version covers the web application and the backend API. The mobile application is out of scope for this version except where the API must support it.

### 1.3 Definitions, acronyms and abbreviations

| Term | Definition |
|---|---|
| City | Any settlement known to Flanr, regardless of size or legal status: a city, town, village or hamlet. A part of another settlement (a district, suburb or borough) is not a city. See BR-001. |
| Settlement type | Classification of a city as city, town, village or hamlet, as provided by the data source. |
| Visit | A record that a user has been to a city once. What counts as a visit is decided by the user. See BR-011. |
| Visit date | The date of a visit, with a precision of day, month or year. |
| Approximate date | A visit date with month or year precision. |
| Lived-in city | A city the user marks as one they live in now or lived in before. What counts as having lived somewhere is decided by the user. See BR-016. |
| Undated visit | A visit without a date. Allowed only for visits that took place before the user's registration date. See BR-002. |
| Registration date | The date on which the user created their account. |
| Criterion | An aspect of a city that can be rated separately, for example architecture or public transport. |
| Subjective rating | The user's overall rating of a city, set directly by the user. It is the user's main rating of the city. |
| Criteria average | The arithmetic mean of the criteria a user has rated for a city. |
| Community rating | The arithmetic mean of all users' subjective ratings of a city. |
| Default list | One of the two lists every user has: Visited and Planned. |
| Custom list | A list of cities created by a user. |
| Place | A point of interest inside a city, for example a landmark or a venue. |
| Feed | The stream of activity of a user's friends and of news from Flanr. |
| Map mode | A way of visualising cities on the map, for example by number of visits. |
| Moderator | A user with permission to approve or reject user-contributed content. |
| MVP | Minimum viable product, the first usable release. |
| OSM | OpenStreetMap. |
| SSR | Server-side rendering. |
| GDPR | General Data Protection Regulation (EU) 2016/679. |

### 1.4 References

| ID | Reference |
|---|---|
| REF-1 | CONCEPT.md, Flanr concept document |
| REF-2 | ISO/IEC/IEEE 29148:2018, Systems and software engineering — Requirements engineering |
| REF-3 | RFC 2119, Key words for use in RFCs to Indicate Requirement Levels |
| REF-4 | RFC 9457, Problem Details for HTTP APIs |
| REF-5 | OpenAPI Specification 3.1 |
| REF-6 | Regulation (EU) 2016/679 (GDPR) |
| REF-7 | Open Database License (ODbL) 1.0, OpenStreetMap data licence |
| REF-8 | WCAG 2.2 |
| REF-9 | OWASP Application Security Verification Standard (ASVS) |

### 1.5 Document overview

Section 2 describes the product as a whole. Section 3 lists business rules that several requirements depend on. Section 4 contains the functional requirements by feature area. Section 5 describes the data, section 6 the external interfaces and section 7 the non-functional requirements. Section 8 lists what is out of scope, and section 9 the open issues.

---

## 2. Overall description

### 2.1 Product perspective

Flanr is a new, standalone product. It consists of:

- a web client built with Next.js and server-side rendering;
- a standalone backend API that serves the web client and, later, the mobile client;
- a PostgreSQL database with PostGIS;
- external services for authentication (Clerk) and the base map (Mapbox);
- city data imported from OpenStreetMap and Wikidata.

The web client does not access the database directly. All data access goes through the API.

### 2.2 Product functions

- Browsing cities, city pages, community ratings and public profiles, also without an account.
- Registration and sign-in.
- Logging visits to cities, with exact, approximate or no dates.
- Rating cities by criteria and with a subjective overall rating.
- Default and custom lists of cities.
- A world map with several visualisation modes and clickable city boundaries.
- Personal statistics and a trip calendar.
- City search with filters and sorting.
- Friends, feed, likes, comments and notifications (R2).
- User photos of cities with moderation (R2).
- Places within cities (Later).
- Affiliate travel offers (Later).

### 2.3 User classes and characteristics

| User class | Description |
|---|---|
| Guest | Not signed in. Can view all public content. Cannot create or change any data. |
| Registered user | Signed in. Manages their own visits, ratings, lists and profile, and interacts with other users. |
| Moderator | Registered user who can review user-contributed content (R2). |
| Administrator | Registered user who can manage users, roles, criteria and city data. |

The expected number of users at launch is one to five.

### 2.4 Operating environment

- The web client runs in current versions of Chrome, Firefox, Safari and Edge on desktop and mobile.
- The API and database run on a hosted server environment.
- An Android client is planned later. An iOS client is only planned if the project shows real commercial potential.

### 2.5 Constraints

| ID | Constraint |
|---|---|
| CON-001 | The whole codebase MUST be written in TypeScript. |
| CON-002 | The web client MUST be built with Next.js using server-side rendering. |
| CON-003 | The backend MUST be a standalone API built with Hono, separate from the web client. |
| CON-004 | The database MUST be PostgreSQL with PostGIS, accessed through Drizzle. |
| CON-005 | Authentication MUST be handled by Clerk. |
| CON-006 | The base map MUST be provided by Mapbox. |
| CON-007 | City data MUST be imported from OpenStreetMap and Wikidata. |
| CON-008 | The code MUST be organised as a monorepo with packages for the web client, the API and shared types and schemas. |
| CON-009 | The API contract MUST be described with OpenAPI 3.1, so that the backend can be reimplemented in another language without changes to the clients. |
| CON-010 | Running costs for external services SHOULD stay within the free tiers at the expected scale and MUST NOT exceed about 25 € per month. |
| CON-011 | The project starts as non-commercial. |
| CON-012 | City data is rolled out in stages: Germany first, then continental Europe for the MVP, and the whole world after the MVP is complete. |

### 2.6 Assumptions and dependencies

- The free tiers of Clerk and Mapbox remain available on similar terms.
- OpenStreetMap and Wikidata remain available under their current licences.
- Some small settlements in OpenStreetMap have no mapped boundaries. Flanr depends on OSM for boundaries and cannot provide them where OSM does not.
- Wikidata does not contain every desirable field for every city. Missing desirable fields are left empty.

---

## 3. Business rules

#### BR-001 — Definition of a city
A city is any settlement of type city, town, village or hamlet. There is no minimum population.

A settlement is a city even when it is administratively part of a municipality, for example Worringen in the municipality of Cologne, Körbecke in Möhnesee or Ostia in Rome. Such a city can be visited and rated on its own, and a visit to it is not a visit to the main city of its municipality.

A part of the continuous built-up area of another settlement, such as a district, suburb or borough (for example Wuppertal-Elberfeld), is not a city. A municipality that is not itself a settlement (for example Oldambt, which consists of Winschoten, Bad Nieuweschans and other settlements) is not a city either.

The line between a separate settlement and a district follows the OpenStreetMap place classification: city, town, village and hamlet are settlements; suburb, quarter, neighbourhood and borough are districts. The one exception is the capital of a country, which is always a city: OpenStreetMap maps Vatican City as a suburb of Rome.

#### BR-002 — Dates of visits
A visit that took place after the user's registration date MUST have a date. A visit that took place before the registration date MAY have no date. A visit MAY be added at any time, including long after registration.

#### BR-003 — Date precision
A visit date has one of three precisions: day, month or year. A visit date MUST NOT be in the future.

#### BR-004 — Default lists are exclusive
A city can be in at most one of the two default lists, Visited and Planned. A city is in the Visited list if and only if the user has at least one visit to it or has marked it as a lived-in city. Logging a visit to a city in the Planned list removes it from the Planned list. A city that is already visited cannot be added to the Planned list. To plan a repeat visit, the user can use a custom list.

#### BR-005 — Rating requires a visit
A user can rate a city only if they have at least one visit to it or have marked it as a lived-in city. When this stops being true, because the user deletes their last visit to a city that is not a lived-in city or removes the lived-in mark from a city without visits, the user's rating of the city is deleted together with its criteria ratings. The user is warned and has to confirm.

#### BR-006 — Rating scale
City ratings use a scale from 1 to 10 in steps of 0.5. The subjective rating is required for a rating to exist. Criteria ratings are optional.

#### BR-007 — Criteria average
The criteria average is the arithmetic mean of the criteria the user has rated for a city. Criteria that are not rated are not counted. When the user sets the subjective rating, the criteria average, if it exists, is suggested as its initial value, rounded to the nearest 0.5. An average exactly between two steps is rounded up: 7.25 becomes 7.5.

#### BR-008 — One rating per user and city
Each user has at most one rating per city. Changing it replaces the previous value.

#### BR-009 — Community rating
The community rating of a city is the arithmetic mean of all users' subjective ratings of that city, including ratings from private profiles. It is displayed rounded to two decimal places, together with the number of ratings.

#### BR-010 — Place rating
Place ratings use a scale from 1 to 5. A place has only one rating per user, with no criteria. A user does not need to have visited the city to rate a place in it.

#### BR-011 — What counts as a visit
The user decides what counts as a visit. Flanr MAY recommend the following model: a visit is either about 24 hours in a city or a shorter stay, depending on the size of the city, during which the user saw something of the city. A stay of several days counts each day as a separate visit.

#### BR-012 — Time-based statistics
Statistics that depend on time use only dated visits. Undated visits count towards the number of visits and visited cities, but not towards time-based statistics.

#### BR-013 — Default visibility
All user content is public by default.

#### BR-014 — Imports never create visits
Importing external location history MUST NOT create, change or delete visits.

#### BR-015 — Free core functionality
Core functionality, including logging visits, rating cities, lists, the map and basic statistics, MUST always be free and MUST NOT be limited, for example by the number of visited cities.

#### BR-016 — Lived-in cities
A user can mark any number of cities as lived-in cities: at most one as the current city and any number as past cities. The user decides what counts as having lived somewhere. A lived-in city counts as a visited city but does not require visits. The user can still log visits to it. The current lived-in city is the user's home location (FR-PROF-003). A lived-in city can have an optional period (from, to) with the same precision rules as visit dates (BR-003). The period is shown with the city but is not part of time-based statistics, which count dated visits only.

#### BR-017 — Cities and municipalities
A city MAY belong to one municipality. The municipality is reference data, like a region: it cannot be visited or rated.

When a city and its municipality are the same thing (for example Cologne), the city represents the municipality. Its boundary, population and area are those of the whole municipality and include the other cities inside it. Because of this, populations MUST NOT be added up across cities without excluding the cities that are part of another city's municipality.

Whether a city and its municipality are the same thing is taken from the source data, not assumed. In Germany the town of Herbstein is the municipality of Herbstein, so the city represents it. In the Netherlands Winschoten is the seat of the municipality of Oldambt but is not that municipality: it keeps its own boundary and population and is part of Oldambt, like every other settlement in it.

---

## 4. Functional requirements

### 4.1 Authentication and accounts (`FR-AUTH`)

#### FR-AUTH-001 — Guest access
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** The system MUST allow guests to view all public content without an account, including city pages, community ratings, global statistics, public profiles and public lists.

**Acceptance criteria.**
1. Given a guest, when they open a city page, then the page is shown with its public data and community rating.
2. Given a guest, when they open a public profile, then the profile and its public lists are shown.

#### FR-AUTH-002 — Registration prompt on write actions
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** When a guest triggers an action that creates or changes data, such as saving a city, logging a visit or rating a city, the system MUST offer them to sign up or sign in. After successful sign-in, the system SHOULD return the user to the page they were on.

**Acceptance criteria.**
1. Given a guest on a city page, when they press the button to save the city, then a sign-up or sign-in dialog is shown.
2. Given a guest who signs in from that dialog, when sign-in succeeds, then they are returned to the same city page.

#### FR-AUTH-003 — Email and password
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** The system MUST allow users to sign up and sign in with an email address and a password. The email address MUST be verified before the account can create content.

**Acceptance criteria.**
1. Given a new user, when they sign up with an email and a password and verify the email, then they can sign in and create content.

#### FR-AUTH-004 — Email and one-time code
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** The system MUST allow users to sign in with an email address and a one-time code sent to that address.

**Acceptance criteria.**
1. Given a registered user, when they request a code and enter it within its validity period, then they are signed in.
2. Given an expired or wrong code, when the user enters it, then sign-in fails with an explanation.

#### FR-AUTH-005 — Google sign-in
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** The system MUST allow users to sign up and sign in with a Google account.

**Acceptance criteria.**
1. Given a user with a Google account, when they choose Google sign-in and confirm, then an account is created or the existing account is signed in.

#### FR-AUTH-006 — Apple sign-in
**Priority:** Won't (now) · **Release:** Later · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** The system SHOULD support Sign in with Apple once development of a mobile application starts.

#### FR-AUTH-007 — Sign out
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** The system MUST allow users to sign out on the current device.

**Acceptance criteria.**
1. Given a signed-in user, when they sign out, then protected actions require signing in again.

#### FR-AUTH-008 — Change email address
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** The system MUST allow users to change their email address. The new address MUST be verified before it replaces the old one.

**Acceptance criteria.**
1. Given a signed-in user, when they enter a new email and verify it, then the new email is used for sign-in.

#### FR-AUTH-009 — Delete account
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** NFR-GDPR-002

**Description.** The system MUST allow users to delete their account. Deletion MUST remove the user's personal data as described in section 5.4.

**Acceptance criteria.**
1. Given a signed-in user, when they confirm account deletion, then they can no longer sign in, their profile is no longer reachable and their ratings no longer count towards community ratings.

#### FR-AUTH-010 — Roles
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** The system MUST support the roles registered user, moderator and administrator. Every new account MUST get the role registered user. Only administrators MUST be able to assign and remove the moderator and administrator roles.

**Acceptance criteria.**
1. Given a new account, then it has the role registered user only.
2. Given a registered user without the administrator role, when they try to assign a role, then the action is rejected.

**Related.** OI-009.

### 4.2 User profile (`FR-PROF`)

#### FR-PROF-001 — Username
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** Every user MUST have a unique username, which is part of their profile URL. A username has 3 to 30 characters: Latin letters, digits and underscores. Uniqueness does not depend on letter case, and names on the reserved list (such as `admin` or `settings`) cannot be chosen. Users MUST be able to change their username at any time if the new one is not taken. The old profile URL does not redirect, and the old username is free for others at once.

**Acceptance criteria.**
1. Given a username that is already taken, when a user tries to choose it, then the system rejects it.
2. Given a user who changes their username, then their profile is available under the new username and the old URL returns Not Found.
3. Given the username `Ada_1`, when another user tries to choose `ada_1`, then the system rejects it.
4. Given the names `ab`, `ada lovelace` and `admin`, when a user tries to choose one of them, then the system rejects it.

#### FR-PROF-002 — Profile information
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** A profile MUST contain a display name and MAY contain an avatar and a short bio. The exact set of fields will be refined in a later version.

**Acceptance criteria.**
1. Given a user, when they set a display name, avatar and bio, then these are shown on their profile.

#### FR-PROF-003 — Home location
**Priority:** Should · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** A user MAY specify where they live. This field MUST be optional and MUST be hideable from other users.

**Acceptance criteria.**
1. Given a user who set a home location and hid it, when another user views the profile, then the home location is not shown.

#### FR-PROF-004 — Public profile page
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Social features

**Description.** A public profile MUST show the user's profile information, their Visited and Planned lists, their public custom lists, their ratings, their map and their basic statistics.

**Acceptance criteria.**
1. Given a public profile, when any visitor opens it, then the listed content is shown.

### 4.3 City data (`FR-CITY`)

#### FR-CITY-001 — City page with required data
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Cities

**Description.** Every city MUST have a city page that shows its name, English name, country, first-level region (where the country has regions), settlement type, capital status, a map with its boundary, and, where they are known, its population with the reference year, its municipality (when the city is part of one, see BR-017) and a link to Wikipedia.

**Acceptance criteria.**
1. Given a city with all required fields, when its page is opened, then all of them are shown.
2. Given a city without a mapped boundary, when its page is opened, then the map shows the city as a point and no error is shown.
3. Given a city without a known population, when its page is opened, then no population field is shown.
4. Given Worringen, when its page is opened, then it is shown as part of Cologne.

**Related.** BR-017, OI-003.

#### FR-CITY-002 — City page with optional data
**Priority:** Should · **Release:** MVP · **Status:** Draft · **Source:** Concept §Cities

**Description.** The city page SHOULD show the desirable fields listed in section 5.2 when they are available. Missing fields MUST be hidden rather than shown as empty.

**Acceptance criteria.**
1. Given a city without an elevation value, when its page is opened, then no elevation field is shown.

#### FR-CITY-003 — Community rating on the city page
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Rating cities

**Description.** The city page MUST show the community rating according to BR-009 and the number of ratings. Ratings SHOULD be coloured with the rating colour scale in Appendix C wherever they are shown. If there are no ratings, the page MUST say so instead of showing a value.

**Acceptance criteria.**
1. Given a city with ratings 7, 8 and 8.5, when its page is opened, then the community rating is shown as 7.83 with 3 ratings.

#### FR-CITY-004 — Personal data on the city page
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Cities

**Description.** For a signed-in user, the city page MUST show their own data for that city: number of visits, list of visits, their rating, and which of their lists contain the city.

**Acceptance criteria.**
1. Given a user with two visits and a rating of 8 for a city, when they open the city page, then two visits and the rating 8 are shown.

#### FR-CITY-005 — Import of city data
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Technology

**Description.** The system MUST import cities from OpenStreetMap, using settlements of type city, town, village and hamlet and their administrative boundaries, and MUST enrich them with data from Wikidata through the Wikidata ID. Each city MUST store the IDs of its source objects.

**Acceptance criteria.**
1. Given an import run, when it completes, then every imported city has an internal ID, an OSM ID and, where available, a Wikidata ID.
2. Given an OSM object tagged as a suburb or borough, then it is not imported as a city.

**Related.** BR-001, OI-002.

#### FR-CITY-006 — Own copy and monthly updates of city data
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Cities

**Description.** Flanr MUST keep its own copy of all city data and MUST NOT query OpenStreetMap or Wikidata while serving user requests. The import SHOULD run automatically once a month and MUST update existing cities by their source IDs without changing their internal IDs or losing user data linked to them. The import MUST load data into staging tables, validate it and only then apply it in one transaction. If the import fails or validation fails, for example because the number of cities drops sharply, the existing data MUST stay unchanged. A city that disappears from the source MUST NOT be deleted if users have data linked to it; it MUST be marked as no longer in the source instead.

**Rationale.** The external services are not built for per-request production traffic, and city data changes slowly. In the worst case, users see data that is a month old.

**Acceptance criteria.**
1. Given a city with user visits, when a new import changes its population, then the population is updated and the visits remain linked to the city.
2. Given an import that fails halfway, then the city data is the same as before the import.
3. Given a city with user visits that is missing in a new import, then it remains available and is marked as no longer in the source.

#### FR-CITY-007 — Suggest a new city
**Priority:** Could · **Release:** R2 · **Status:** Draft · **Source:** Concept §Cities

**Description.** Registered users MAY suggest a city that is missing from Flanr. A suggestion MUST go through moderation before the city is created.

#### FR-CITY-008 — Suggest a correction
**Priority:** Could · **Release:** R2 · **Status:** Draft · **Source:** Concept §Cities

**Description.** Registered users MAY suggest corrections to a city's data. A correction MUST go through moderation before it is applied.

#### FR-CITY-009 — Links to external maps
**Priority:** Should · **Release:** MVP · **Status:** Draft · **Source:** Owner, 2026-11-11

**Description.** The city page SHOULD offer links that open the city in external map services: at least OpenStreetMap, Google Maps and Apple Maps. The links MUST be built from the city's name, coordinates and OpenStreetMap ID through a list of link templates, and MUST NOT be stored per city, so that a service can be added or changed in one place.

**Acceptance criteria.**
1. Given the page of Cologne, when the user follows the OpenStreetMap link, then OpenStreetMap opens the object that Flanr imported the city from.
2. Given a new map service added to the list of templates, then its link appears on every city page without changes to city data.

#### FR-CITY-010 — City districts
**Priority:** Could · **Release:** Later · **Status:** Draft · **Source:** Owner, 2026-11-11

**Description.** The system MAY import the districts of cities (suburbs, quarters, neighbourhoods and boroughs) and show them on the city page and on the map as additional information. Districts are not cities (BR-001): they cannot be visited, rated or added to lists.

### 4.4 Visits and dates (`FR-VIS`)

#### FR-VIS-001 — Log a visit
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Visits and dates

**Description.** A registered user MUST be able to log a visit to a city.

**Acceptance criteria.**
1. Given a user on a city page, when they log a visit with a date, then the visit is saved and the number of visits to the city increases by one.

**Related.** BR-004.

#### FR-VIS-002 — Date precision
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Visits and dates

**Description.** When logging or editing a visit, the user MUST be able to enter the date with day, month or year precision, according to BR-003.

**Acceptance criteria.**
1. Given a user, when they enter only a month and a year, then the visit is saved with month precision.
2. Given a user, when they enter a date in the future, then the system rejects it.

#### FR-VIS-003 — Undated visits before registration
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Visits and dates

**Description.** When adding a visit without a date, the user MUST confirm that the visit took place before their registration date. Without this confirmation, the system MUST NOT save an undated visit.

**Acceptance criteria.**
1. Given a user who adds an undated visit and confirms it was before registration, then the visit is saved.
2. Given a user who adds an undated visit without confirming, then the system asks for a date.

**Related.** BR-002, FR-VIS-004.

#### FR-VIS-004 — Date required for visits after registration
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Visits and dates

**Description.** The system MUST require a date (with any allowed precision) for every visit that took place after the user's registration date.

**Rationale.** Time-based statistics only work with dated visits, but users cannot be expected to remember the dates of trips made before they started using Flanr.

**Acceptance criteria.**
1. Given a user registered on 2026-03-01, when they add a visit dated 2026-05 with month precision, then the visit is saved.
2. Given the same user, when they try to add a visit dated 2026-05-10 and later remove the date, then the system rejects the change.

**Related.** BR-002, BR-012.

#### FR-VIS-005 — Add several undated visits at once
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Visits and dates

**Description.** The user MUST be able to set the number of their undated visits to a city directly, for example "5 times", instead of adding each visit separately. Increasing or decreasing this number MUST add or remove undated visits accordingly.

**Acceptance criteria.**
1. Given a user with 5 undated visits to Düsseldorf, when they change the number to 6, then the city has 6 undated visits.
2. Given the same user, when they change the number to 4, then one undated visit is removed and dated visits are not affected.

#### FR-VIS-006 — Edit and delete visits
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Visits and dates

**Description.** The user MUST be able to edit and delete their own visits, subject to BR-002 and BR-003.

**Acceptance criteria.**
1. Given a user's visit, when they change its date, then the new date is saved.
2. Given a user's only visit to a city, when they delete it, then the city is removed from their Visited list.
3. Given a user's only visit to a rated city that is not a lived-in city, when they confirm deleting it, then the rating is deleted too (BR-005).

**Related.** BR-005.

#### FR-VIS-007 — Onboarding of past visits
**Priority:** Should · **Release:** MVP · **Status:** Draft · **Source:** Concept §Visits and dates

**Description.** After registration, the system SHOULD offer a flow for quickly adding cities the user has already visited, with an optional number of visits and optional dates.

**Acceptance criteria.**
1. Given a newly registered user, when they complete the onboarding flow with three cities, then the three cities are in their Visited list with the entered numbers of visits.

#### FR-VIS-008 — Recommended visit definition
**Priority:** Could · **Release:** MVP · **Status:** Draft · **Source:** Concept §Visits and dates

**Description.** The system MAY show the recommended visit model from BR-011 as guidance when the user logs a visit or during onboarding.

**Acceptance criteria.**
1. Given a user logging a visit, when they open the help hint, then the recommended model is shown.

#### FR-VIS-009 — Visit details
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Visits and dates

**Description.** A visit SHOULD be able to have a title, a description and photos, and other users SHOULD be able to comment on it, similar to an activity on Strava.

**Related.** FR-SOC-005, OI-006.

#### FR-VIS-010 — Lived-in cities
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Cities the user has lived in

**Description.** The user MUST be able to mark a city as a lived-in city, either current or past, and remove the mark, according to BR-016. Marking a city as the current lived-in city MUST replace the previous current one, which becomes a past lived-in city.

**Acceptance criteria.**
1. Given a user without visits to Wuppertal, when they mark it as current lived-in city, then Wuppertal is in their Visited list, can be rated and is their home location.
2. Given Wuppertal as the current city, when the user marks Aachen as current, then Wuppertal becomes a past lived-in city.
3. Given a lived-in city, when the user logs a dated visit to it, then the visit is saved and counted in the statistics.

**Related.** BR-004, BR-005, BR-016.

### 4.5 City ratings (`FR-RATE`)

#### FR-RATE-001 — Subjective rating
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Rating cities

**Description.** A registered user who has visited a city MUST be able to give it a subjective rating according to BR-005 and BR-006.

**Acceptance criteria.**
1. Given a user with a visit to a city, when they set a rating of 7.5, then the rating is saved.
2. Given a user without a visit to a city, then the rating control is not available.
3. Given a user, when they try to set a rating of 7.3, then the system rejects it.

#### FR-RATE-002 — Criteria ratings
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Rating cities

**Description.** Together with the subjective rating, the user MUST be able to rate any subset of the criteria on the same scale. The initial criteria are architecture, urbanism, greenery, public transport, safety and cleanliness.

**Acceptance criteria.**
1. Given a user, when they rate only architecture and safety, then only these two criteria are saved.

#### FR-RATE-003 — Suggested subjective rating
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Rating cities

**Description.** When the user has rated at least one criterion and sets the subjective rating, the system MUST suggest the criteria average according to BR-007, rounded to the nearest 0.5, as the initial value. The user MUST be able to accept or change it.

**Acceptance criteria.**
1. Given criteria ratings of 7, 8 and 9, when the user opens the subjective rating, then 8 is suggested.
2. Given the suggested value, when the user changes it to 9.5, then 9.5 is saved as the subjective rating.
3. Given criteria ratings of 7 and 7.5, when the user opens the subjective rating, then 7.5 is suggested.

**Related.** BR-007.

#### FR-RATE-004 — Change and delete a rating
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Rating cities

**Description.** The user MUST be able to change or delete their rating of a city at any time. Each user has one rating per city, according to BR-008.

**Acceptance criteria.**
1. Given a user with a rating of 7, when they change it to 8, then 8 replaces 7 and the community rating is updated.

#### FR-RATE-005 — Per-criterion community averages
**Priority:** Should · **Release:** MVP · **Status:** Draft · **Source:** Concept §Rating cities

**Description.** The city page SHOULD show the community average of each criterion and the number of ratings for it.

**Acceptance criteria.**
1. Given a city where three users rated public transport, when its page is opened, then the average public transport rating and the count 3 are shown.

#### FR-RATE-006 — Managing criteria
**Priority:** Should · **Release:** MVP · **Status:** Draft · **Source:** Concept §Rating cities

**Description.** Administrators SHOULD be able to add new criteria without code changes. Removing a criterion MUST NOT delete existing ratings of it.

**Acceptance criteria.**
1. Given an administrator, when they add the criterion "nightlife", then users can rate it for any city.

#### FR-RATE-007 — Community rating by period
**Priority:** Could · **Release:** Later · **Status:** Draft · **Source:** Concept §Rating cities

**Description.** Users MAY filter the community rating of a city by the period in which ratings were given or last changed, to see how the city has changed over time.

**Related.** OI-004.

#### FR-RATE-008 — Text reviews
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Rating cities

**Description.** Users SHOULD be able to write text reviews of cities.

**Related.** OI-006.

### 4.6 Lists (`FR-LIST`)

#### FR-LIST-001 — Default lists
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Lists

**Description.** Every user MUST have the default lists Visited and Planned, which cannot be deleted or renamed. The Visited list MUST consist exactly of the cities the user has at least one visit to or has marked as a lived-in city (BR-004).

**Acceptance criteria.**
1. Given a new user, then both default lists exist and are empty.
2. Given a user who logs the first visit to a city, then the city appears in the Visited list.

**Related.** BR-004.

#### FR-LIST-002 — Planned list
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Lists

**Description.** The user MUST be able to add cities they have not visited to the Planned list and remove them from it. When the user logs a visit to a city in the Planned list, the system MUST move it to the Visited list automatically.

**Acceptance criteria.**
1. Given a city in the Planned list, when the user logs a visit to it, then the city is in the Visited list and no longer in the Planned list.
2. Given a visited city, then the option to add it to the Planned list is not available.

#### FR-LIST-003 — Custom lists
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Lists

**Description.** The user MUST be able to create, rename and delete custom lists. A custom list MUST have a title and MAY have a description. There is no limit on the number of custom lists.

**Acceptance criteria.**
1. Given a user, when they create a list "Cities with the best tram networks", then the list appears on their profile.

#### FR-LIST-004 — List entries
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Lists

**Description.** The user MUST be able to add any city to a custom list, remove it and reorder the entries. Each entry MAY have a note. A city MUST NOT appear twice in the same list.

**Acceptance criteria.**
1. Given a list with three cities, when the user moves the third to the top, then the new order is saved.
2. Given a city already in a list, when the user adds it again, then the system rejects it.

#### FR-LIST-005 — List visibility
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Lists

**Description.** Every list, default or custom, MUST be either public or private, and MUST be public by default. Private lists MUST be visible only to their owner.

**Acceptance criteria.**
1. Given a new custom list, then it is public.
2. Given a private list, when another user opens the owner's profile, then the list is not shown.

**Related.** BR-013, FR-PRIV-001.

#### FR-LIST-006 — List discovery
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Lists

**Description.** Public default lists MUST be visible on the owner's profile. Public custom lists MUST be visible on the owner's profile and MUST be findable through search.

**Acceptance criteria.**
1. Given a public custom list titled "Half-timbered towns", when a guest searches lists for "half-timbered", then the list is found.

#### FR-LIST-007 — Like and save lists
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Lists

**Description.** Registered users SHOULD be able to like other users' public lists and save them for later. The number of likes SHOULD be shown on the list.

### 4.7 Map (`FR-MAP`)

#### FR-MAP-001 — Base map
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Technology

**Description.** The system MUST show an interactive world map with country borders and place labels, in a standard style and a satellite style that the user can switch between.

**Acceptance criteria.**
1. Given the map, when the user switches to the satellite style, then satellite imagery with labels is shown.

#### FR-MAP-002 — Globe and flat view
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Technology

**Description.** The map MUST support a globe view at low zoom levels and a flat view at high zoom levels.

**Acceptance criteria.**
1. Given the map zoomed out to the whole world, then the Earth is shown as a globe.

#### FR-MAP-003 — City layer
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Technology

**Description.** Cities MUST be drawn as Flanr's own layer on top of the base map, based on Flanr's own data, and not taken from the base map's labels.

**Rationale.** Clicks must resolve to Flanr's own city IDs, and the base map must remain replaceable.

**Acceptance criteria.**
1. Given the city layer, when the user clicks a city marker, then the system identifies the city by its Flanr ID.

#### FR-MAP-004 — Selecting a city on the map
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Map and statistics

**Description.** When the user clicks a city on the map, the system MUST highlight its boundary and show a short preview with its name, country, community rating, the user's own data and a link to the city page.

**Acceptance criteria.**
1. Given the map, when the user clicks Cologne, then its boundary is highlighted and the preview is shown.

#### FR-MAP-005 — Map modes
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Map and statistics

**Description.** The personal map MUST offer at least three modes for the user's cities:
1. By number of visits: marker size and colour depend on the number of visits.
2. By rating: marker colour depends on the user's subjective rating, using the rating colour scale in Appendix C.
3. By population: marker size and colour depend on the city's population.

Each mode MUST have a legend.

**Acceptance criteria.**
1. Given a user with one city visited once and another visited ten times, when the visits mode is selected, then the second marker is larger and has a different colour.
2. Given the rating mode, then cities without a rating are shown in a neutral colour that is explained in the legend.
3. Given the visits mode, then lived-in cities are shown with a distinct marker that is explained in the legend.

#### FR-MAP-006 — Planned cities on the map
**Priority:** Should · **Release:** MVP · **Status:** Draft · **Source:** Concept §Lists

**Description.** The personal map SHOULD be able to show cities from the Planned list, visually distinct from visited cities.

**Acceptance criteria.**
1. Given a user with planned cities, when they enable planned cities on the map, then these are shown with a distinct marker style.

#### FR-MAP-007 — Map on other users' profiles
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Social features

**Description.** A public profile MUST show the user's map with the same modes as the personal map.

**Acceptance criteria.**
1. Given a public profile, when a guest opens its map, then the owner's visited cities are shown.

### 4.8 Statistics (`FR-STAT`)

#### FR-STAT-001 — Summary statistics
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Map and statistics

**Description.** The system MUST show each user the number of visited cities, visited countries and visits, including undated visits. Lived-in cities count as visited cities and are also shown as a separate number. Marking a city as lived-in does not add visits.

**Acceptance criteria.**
1. Given a user with 3 visits to Paris and 1 to Lyon, then they have 2 cities, 1 country and 4 visits.

#### FR-STAT-002 — Statistics by country and region
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Map and statistics

**Description.** The system MUST show visual statistics per country and per first-level region, at least the number of visited cities and visits in each.

**Acceptance criteria.**
1. Given a user with visits in Germany and France, then each country is shown with its numbers of cities and visits.

#### FR-STAT-003 — Trip calendar
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Map and statistics

**Description.** The system MUST show a calendar of dated visits similar to the GitHub contribution graph, where each day is coloured by the number of visits on that day. Visits with month or year precision MUST NOT be placed on specific days.

**Acceptance criteria.**
1. Given two visits on 2026-05-10, then that day has a stronger colour than a day with one visit.
2. Given a visit with month precision, then it does not appear on any day of the calendar.

**Related.** BR-012, OI-008.

#### FR-STAT-004 — Time-based statistics use dated visits only
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Visits and dates

**Description.** All time-based statistics MUST follow BR-012, and the system SHOULD show the period they cover.

**Acceptance criteria.**
1. Given a user whose earliest dated visit is in January 2026, then the time-based statistics state that they cover the period from January 2026.

#### FR-STAT-005 — Global statistics
**Priority:** Should · **Release:** MVP · **Status:** Draft · **Source:** Concept §Accounts and guests

**Description.** The system SHOULD show statistics across all users, such as the most visited and best rated cities, also to guests.

**Acceptance criteria.**
1. Given a guest, when they open the global statistics page, then the most visited cities are shown.

#### FR-STAT-006 — Monthly visual statistics
**Priority:** Could · **Release:** Later · **Status:** Draft · **Source:** Concept §Map and statistics

**Description.** The system MAY show which cities were visited in a year month by month, either by switching between months or by gradually filling in the map. Details will be defined closer to implementation.

### 4.9 Search (`FR-SRCH`)

#### FR-SRCH-001 — City search
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Cities

**Description.** The system MUST let users find cities by their local name, English name, alternative names and transliterations. The search SHOULD tolerate minor typos and ignore diacritics.

**Acceptance criteria.**
1. Given the query "Cologne", then Köln is found.
2. Given the query "Koln", then Köln is found.
3. Given the query "Kiev", then Kyiv is found.

#### FR-SRCH-002 — Disambiguation
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Cities

**Description.** Search results MUST show the country, region and settlement type of each city, and its municipality when the city is part of one (BR-017), so that cities with the same name can be told apart.

**Acceptance criteria.**
1. Given the query "Frankfurt", then Frankfurt am Main and Frankfurt (Oder) are shown with their regions.
2. Given the query "Stockhausen", then the Stockhausen that is part of Herbstein is shown with that municipality.

#### FR-SRCH-003 — Filtering and sorting
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Rating cities

**Description.** The user MUST be able to filter cities by country, region, settlement type and population range, and sort them by community rating, number of ratings, population and name. Filtering by a minimum community rating MUST be supported.

**Acceptance criteria.**
1. Given the filter country = Germany and sorting by community rating, then German cities are listed from the highest community rating.

**Related.** OI-011.

#### FR-SRCH-004 — List search
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Lists

**Description.** The system MUST let users search public custom lists by title and description.

**Acceptance criteria.**
1. See FR-LIST-006.

#### FR-SRCH-005 — User search
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Social features

**Description.** The system SHOULD let users find other users by username and display name.

### 4.10 Social: friends, feed, notifications (`FR-SOC`)

The social part is the least worked-out area. The requirements below describe the agreed direction and will be detailed before R2.

#### FR-SOC-001 — Friends
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Social features

**Description.** Registered users SHOULD be able to send friend requests. A friendship SHOULD be created only after the other user accepts the request. Either side SHOULD be able to end the friendship.

**Related.** OI-001.

#### FR-SOC-002 — Friend profiles
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Social features

**Description.** Users SHOULD be able to see all completed and planned trips of their friends on their profiles.

#### FR-SOC-003 — Feed
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Social features

**Description.** The system SHOULD show a feed with friends' activity, such as new visits, ratings and lists, in reverse chronological order.

#### FR-SOC-004 — News from Flanr
**Priority:** Could · **Release:** R2 · **Status:** Draft · **Source:** Concept §Social features

**Description.** The feed MAY contain automatically generated news, for example a list that is gaining popularity, or a city the user has visited that has recently been rated better than before.

#### FR-SOC-005 — Likes and comments
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Social features

**Description.** Users SHOULD be able to like and comment on activity in the feed, including visits.

#### FR-SOC-006 — Notifications
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Social features

**Description.** Notifications, such as replies to comments and new friend requests, SHOULD be shown in the feed. The feed SHOULD be filterable by type of entry.

### 4.11 Privacy (`FR-PRIV`)

#### FR-PRIV-001 — Profile visibility
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Privacy

**Description.** The user MUST be able to set their whole profile to public or private. A profile MUST be public by default. There MUST NOT be separate visibility settings for individual visits or ratings.

**Acceptance criteria.**
1. Given a private profile, when a guest or another user opens it, then only the username and display name are shown, with a note that the profile is private.

**Related.** OI-012.

#### FR-PRIV-002 — Private ratings in community ratings
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Privacy

**Description.** Ratings from private profiles MUST count towards community ratings according to BR-009, without revealing who gave them.

**Acceptance criteria.**
1. Given a private user who rated a city, then the community rating includes their rating and no page links the rating to them.

#### FR-PRIV-003 — Private content in global statistics
**Priority:** Must · **Release:** MVP · **Status:** Draft · **Source:** Concept §Privacy

**Description.** Content from private profiles MAY be included in aggregated global statistics, but MUST NOT be shown individually anywhere except to its owner.

**Acceptance criteria.**
1. Given a private user's visit to a city, then the visit is not shown in any list or feed visible to other users.

### 4.12 Photos and attachments (`FR-ATT`)

#### FR-ATT-001 — Upload city photos
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Photos and attachments

**Description.** Registered users SHOULD be able to upload photos to a city. Limits on format, size and number will be defined before R2.

**Related.** OI-013.

#### FR-ATT-002 — Moderated public gallery
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Photos and attachments

**Description.** A photo SHOULD become part of the city's public gallery only after a moderator approves it.

### 4.13 Places (`FR-PLACE`)

#### FR-PLACE-001 — Places in cities
**Priority:** Could · **Release:** Later · **Status:** Draft · **Source:** Concept §Places

**Description.** The system MAY support places within cities, each belonging to exactly one city and one category from a list defined by the developer. A place is a point on the map with a name and basic information. Its exact fields will be defined later.

**Related.** OI-014.

#### FR-PLACE-002 — Contributing places
**Priority:** Could · **Release:** Later · **Status:** Draft · **Source:** Concept §Places

**Description.** Registered users MAY suggest new places. A place MUST become public only after a moderator approves it.

#### FR-PLACE-003 — Rating places
**Priority:** Could · **Release:** Later · **Status:** Draft · **Source:** Concept §Places

**Description.** Registered users MAY rate places according to BR-010. The city page MAY show the highest-rated places of the city.

### 4.14 Moderation (`FR-MOD`)

#### FR-MOD-001 — Moderation queue
**Priority:** Should · **Release:** R2 · **Status:** Draft · **Source:** Concept §Moderation

**Description.** The system SHOULD provide moderators with a queue of pending contributions: photos, places and suggested changes to city data. Moderators SHOULD be able to approve or reject each item. The detailed process will be defined before R2.

**Related.** OI-009.

### 4.15 Google Maps Timeline import (`FR-IMP`)

#### FR-IMP-001 — Timeline visualisation
**Priority:** Could · **Release:** Later · **Status:** Draft · **Source:** Concept §Map and statistics

**Description.** The system MAY read a Google Maps Timeline export (Timeline.json) to produce additional visualisations. The import MUST follow BR-014.

**Related.** OI-015.

### 4.16 Affiliate offers (`FR-AFF`)

#### FR-AFF-001 — Accommodation offers
**Priority:** Could · **Release:** Later · **Status:** Draft · **Source:** Concept §Monetization

**Description.** The city page MAY show an offer to view accommodation in the city, provided by an accommodation aggregator. The offer MUST be placed below the main content of the page and MUST NOT interrupt the user.

#### FR-AFF-002 — Priority for planned cities
**Priority:** Could · **Release:** Later · **Status:** Draft · **Source:** Concept §Monetization

**Description.** Accommodation offers SHOULD be shown with higher prominence for cities in the user's Planned list.

#### FR-AFF-003 — Consent
**Priority:** Must · **Release:** Later · **Status:** Draft · **Source:** Concept §Monetization

**Description.** Affiliate content that sets tracking cookies MUST NOT load before the user has given consent.

**Related.** NFR-GDPR-004.

#### FR-AFF-004 — Tours and transport
**Priority:** Could · **Release:** Later · **Status:** Draft · **Source:** Concept §Monetization

**Description.** The system MAY show offers for tours and activities, for example linked to places, and MAY offer to plan a route to the city through a transport search service.

---

## 5. Data requirements

### 5.1 Conceptual data model

```
User 1───* Visit *───1 City
User 1───* CityRating *───1 City
CityRating 1───* CriterionRating *───1 Criterion
User 1───* List 1───* ListEntry *───1 City
City *───1 Country
City *───1 Region (first level)
City *───0..1 Region (second level)
City *───0..1 Municipality
City 1───* CityName
User 1───* LivedCity *───1 City
User *───* User                      (Friendship, R2)
User 1───* Photo *───1 City          (R2)
City 1───* Place *───1 PlaceCategory (Later)
User 1───* PlaceRating *───1 Place   (Later)
User 1───* Contribution              (moderation queue, R2)
```

The two default lists are not stored as list entries. Visited is derived from visits, and Planned is stored as a set of cities per user. This guarantees BR-004 by design.

### 5.2 Entities

#### User
| Attribute | Required | Notes |
|---|---|---|
| id | yes | Internal ID |
| auth_provider_id | yes | Clerk user ID |
| username | yes | Unique, changeable |
| display_name | yes | |
| avatar | no | |
| bio | no | |
| home_city_id | no | Derived from the current lived-in city, see BR-016 |
| home_city_visible | yes | Default false |
| profile_visibility | yes | public / private, default public |
| roles | yes | user, moderator, administrator |
| registered_at | yes | Basis for BR-002 |

#### City
| Attribute | Required | Notes |
|---|---|---|
| id | yes | Internal ID, stable across imports |
| osm_id, osm_type | yes | Source object |
| wikidata_id | no | Required where it exists in OSM |
| name_local | yes | |
| name_en | yes | Falls back to the local name if no English name exists |
| country_code | yes | ISO 3166-1 alpha-2 |
| region_1_id | no | First-level region. Required in countries that have first-level regions; some small countries, such as Monaco and Vatican City, have none |
| centre | yes | Point |
| boundary | yes* | Polygon or multipolygon. *Required where OSM has one. Settlements without a mapped boundary are stored as points only (OI-003) |
| population | no | Required where it is known. For a city that represents its municipality it is the population of the whole municipality, see BR-017 |
| population_year | no | Year the population refers to, where known |
| settlement_type | yes | city, town, village, hamlet |
| capital_status | yes | national, regional, none |
| wikipedia_url | no | Required where it exists |
| region_2_id | no | Second-level region |
| municipality_id | no | The municipality the city belongs to, see BR-017 |
| represents_municipality | yes | True when the city and its municipality are the same thing. Default false |
| area_km2 | no | Population density is derived from it |
| time_zone | no | |
| elevation_m | no | |
| description | no | Short extract from Wikipedia |
| main_image | no | Free licence only, with attribution |
| coat_of_arms, flag | no | |
| website | no | |
| metro_population | no | |
| founded | no | Year of founding or first mention |
| population_history | no | List of (year, population) |
| transport_modes | no | For example metro, tram, S-Bahn |
| unesco_sites | no | |
| twin_cities | no | References to other cities |

#### Municipality
The lowest administrative unit with its own local government (Gemeinde, gemeente, commune, kommune, hromada). Its administrative level in OpenStreetMap differs by country. Not every country has municipalities everywhere; a city without one simply has no municipality.

| Attribute | Required | Notes |
|---|---|---|
| id | yes | Internal ID, stable across imports |
| osm_id, osm_type | yes | Source object |
| wikidata_id | no | |
| name_local | yes | |
| name_en | yes | Falls back to the local name |
| country_code | yes | |
| boundary | yes | |

#### CityName
Alternative names, transliterations and names in other languages, each with a language code where known. Used by search.

#### Visit
| Attribute | Required | Notes |
|---|---|---|
| id | yes | |
| user_id, city_id | yes | |
| date | no | Normalised to the first day of the period for month and year precision |
| date_precision | yes | day, month, year, none |
| before_registration | yes | Must be true if date_precision is none |
| title, description | no | R2 |
| created_at | yes | |

#### LivedCity
| Attribute | Required | Notes |
|---|---|---|
| user_id, city_id | yes | Unique pair |
| is_current | yes | At most one current city per user |
| from, to | no | Optional period, same precision rules as visit dates, see BR-016 |

#### CityRating
| Attribute | Required | Notes |
|---|---|---|
| user_id, city_id | yes | Unique pair |
| subjective | yes | 1–10, step 0.5 |
| created_at, updated_at | yes | Needed for FR-RATE-007 |

#### CriterionRating
user_id, city_id, criterion_id, value (1–10, step 0.5).

#### Criterion
id, key, name, active, sort_order.

#### List and ListEntry
List: id, user_id, title, description, visibility, created_at. ListEntry: list_id, city_id, position, note. Planned: user_id, city_id, created_at.

### 5.3 External data sources

| Source | Used for | Licence |
|---|---|---|
| OpenStreetMap | Settlements, boundaries, settlement type, names | ODbL |
| Wikidata | All other city fields | CC0 |
| Wikimedia Commons | Main images, coats of arms, flags | Per file, free licences only |

The import MUST use regional OpenStreetMap extracts from Geofabrik (PBF format) instead of the full OSM planet file, starting with Germany. The import filters them to settlements and administrative boundaries and links each settlement to its boundary itself. See OI-002.

Settlements that have no mapped boundary in OSM MUST be imported with their centre point only and MUST NOT be skipped. See OI-003 and FR-CITY-001.

### 5.4 Data retention and deletion

- When a user deletes their account, the system MUST delete their profile, visits, ratings, criteria ratings, lists and planned cities.
- After deletion, the user's ratings MUST no longer count towards community ratings.
- In R2, the handling of the user's comments and approved photos will be defined. See OI-016.
- The system MUST keep daily database backups for at least 7 days. Deleted data MAY remain in backups until they expire.

---

## 6. External interface requirements

### 6.1 User interfaces

The web client MUST be responsive and usable on desktop and mobile screens. The MVP contains at least the following screens:

| Screen | Content |
|---|---|
| Home | Search, global statistics, entry points to the map and profile |
| City page | City data, map with boundary, community rating, personal data, log visit and rate actions |
| Map | Personal map with modes and style switch |
| Profile | Profile information, lists, ratings, map, statistics |
| List page | Title, description, entries with notes |
| Search | Cities and lists with filters and sorting |
| Onboarding | Quick adding of past visits |
| Settings | Account, email, profile visibility, account deletion |

### 6.2 API

- The API MUST be a JSON over HTTPS API, versioned with a path prefix such as `/v1`.
- The API MUST be described in an OpenAPI 3.1 document, generated from the same schemas that validate requests.
- Authenticated requests MUST carry a Clerk session token as a bearer token. The API MUST verify the token on every request.
- Errors MUST be returned in the format of RFC 9457 (Problem Details).
- List endpoints MUST be paginated.
- Geometries MUST be returned as GeoJSON. Large layers, such as the city layer for the map, SHOULD be served as vector tiles.

### 6.3 External systems

| System | Purpose | Release |
|---|---|---|
| Clerk | Authentication and user management | MVP |
| Mapbox | Base map, globe, satellite imagery | MVP |
| OpenStreetMap, Wikidata | City data import | MVP |
| Object storage | Photos | R2 |
| Accommodation aggregator | Affiliate offers | Later |

---

## 7. Non-functional requirements

### 7.1 Performance (`NFR-PERF`)

| ID | Requirement |
|---|---|
| NFR-PERF-001 | City pages SHOULD reach Largest Contentful Paint within 2.5 s on a typical mobile connection. |
| NFR-PERF-002 | City search SHOULD return results within 300 ms at the 95th percentile, measured at the API. |
| NFR-PERF-003 | The map SHOULD stay interactive when showing all visited cities of a user with 1,000 visited cities. |

### 7.2 Scalability (`NFR-SCAL`)

| ID | Requirement |
|---|---|
| NFR-SCAL-001 | The system MUST support the expected scale of one to five users without paid infrastructure beyond CON-010. |
| NFR-SCAL-002 | The API SHOULD be stateless, so that it can be scaled horizontally later. |

### 7.3 Availability and reliability (`NFR-REL`)

| ID | Requirement |
|---|---|
| NFR-REL-001 | The database MUST be backed up daily, see section 5.4. |
| NFR-REL-002 | A failed city data import MUST NOT leave the city data partially updated. |

### 7.4 Security (`NFR-SEC`)

| ID | Requirement |
|---|---|
| NFR-SEC-001 | All traffic MUST use HTTPS. |
| NFR-SEC-002 | The API MUST validate all input against its schemas. |
| NFR-SEC-003 | The API MUST check on every request that the user may access or change the requested resource. |
| NFR-SEC-004 | Write endpoints MUST be rate-limited. |
| NFR-SEC-005 | The system SHOULD meet OWASP ASVS level 1. |
| NFR-SEC-006 | Secrets MUST NOT be stored in the repository. |

### 7.5 Privacy and GDPR (`NFR-GDPR`)

| ID | Requirement |
|---|---|
| NFR-GDPR-001 | The system MUST provide a privacy policy and an imprint. |
| NFR-GDPR-002 | Users MUST be able to delete their account and data, see FR-AUTH-009. |
| NFR-GDPR-003 | Users SHOULD be able to export their data in a machine-readable format. |
| NFR-GDPR-004 | Non-essential cookies, including affiliate tracking, MUST NOT be set before consent. |
| NFR-GDPR-005 | Personal data SHOULD be stored in the EU. |

### 7.6 Usability and accessibility (`NFR-UX`)

| ID | Requirement |
|---|---|
| NFR-UX-001 | The web client MUST be usable on screens from 360 px wide. |
| NFR-UX-002 | The web client SHOULD meet WCAG 2.2 level AA, except for the map itself. |
| NFR-UX-003 | Logging a visit from a city page SHOULD take no more than three interactions. |

### 7.7 Localization (`NFR-L10N`)

| ID | Requirement |
|---|---|
| NFR-L10N-001 | The interface MUST be available in English. |
| NFR-L10N-002 | All interface text SHOULD be kept in translation files, so that more languages can be added without code changes. |
| NFR-L10N-003 | Dates and numbers SHOULD be formatted according to the user's locale. |

### 7.8 Maintainability (`NFR-MAINT`)

| ID | Requirement |
|---|---|
| NFR-MAINT-001 | TypeScript MUST be used in strict mode. |
| NFR-MAINT-002 | Business rules in section 3 MUST be covered by automated tests. |
| NFR-MAINT-003 | Database schema changes MUST be made through versioned migrations. |
| NFR-MAINT-004 | Types and schemas shared between the web client and the API MUST live in the shared package. |

### 7.9 Portability (`NFR-PORT`)

| ID | Requirement |
|---|---|
| NFR-PORT-001 | The API contract MUST NOT depend on the backend framework, see CON-009. |
| NFR-PORT-002 | The base map provider MUST be replaceable without changes to the city layer, see FR-MAP-003. |
| NFR-PORT-003 | The API MUST be usable by a future mobile client without changes specific to the web client. |

### 7.10 Licensing and attribution (`NFR-LIC`)

| ID | Requirement |
|---|---|
| NFR-LIC-001 | The map and city pages MUST show the attribution required by OpenStreetMap and Mapbox. |
| NFR-LIC-002 | The use of OSM data MUST comply with the ODbL. |
| NFR-LIC-003 | Images from Wikimedia Commons MUST be shown with author and licence. |

---

## 8. Out of scope

- An iOS application, unless the project shows real commercial potential.
- An Android application in this version.
- Offline use.
- Booking or selling travel inside Flanr.
- A paid subscription. If introduced later, it MUST follow BR-015.
- Creating visits from imported location history, see BR-014.
- Separate visibility settings for individual visits or ratings.

---

## 9. Open issues

| ID | Issue | Area | Status |
|---|---|---|---|
| OI-001 | Friendship model: mutual friendship with requests, one-way following, or both. | Social | Open, before R2 |
| OI-002 | Which OSM extract to use for the initial import: Geoapify, Overture Maps Divisions or a custom extract. | Data | Resolved 2026-11-10: Geofabrik regional extracts, see §5.3 |
| OI-003 | How to treat settlements without a mapped boundary: import them as points only, or skip them. | Data | Resolved 2026-11-10: import as points only, see §5.3 |
| OI-004 | How the community rating should take into account that cities change over time. | Ratings | Open |
| OI-005 | What happens to a rating when the user deletes all their visits to the city. | Ratings | Resolved 2026-11-12: the rating is deleted after a confirmation, see BR-005 |
| OI-006 | How text reviews relate to visit posts in the social part. | Ratings, Social | Open, before R2 |
| OI-007 | Confirm that the suggested subjective rating is the criteria average rounded to the nearest 0.5. | Ratings | Resolved 2026-11-12: confirmed, halves round up, see BR-007 |
| OI-008 | Whether and how visits with month or year precision appear in the trip calendar or in a separate monthly view. | Statistics | Open |
| OI-009 | Detailed role model and moderation process. | Moderation | Open, before R2 |
| OI-010 | Username rules: allowed characters, how often it can be changed, whether old profile URLs redirect. | Profile | Resolved 2026-11-12: see FR-PROF-001 |
| OI-011 | Whether sorting by community rating requires a minimum number of ratings. | Search | Open |
| OI-012 | Whether friends can see a private profile. | Privacy | Open, before R2 |
| OI-013 | Limits for photos: formats, size, number per user and city. | Photos | Open, before R2 |
| OI-014 | Fields of a place and the list of place categories. | Places | Open |
| OI-015 | Whether a Timeline.json file is processed on the client or on the server, and whether it is stored. | Import | Open |
| OI-016 | What happens to comments and approved photos when a user deletes their account. | Data | Open, before R2 |
| OI-017 | Hosting provider for the web client, API and database. | Operations | Open |
| OI-019 | Whether a lived-in city can have a period (from, to), and how lived-in periods appear in time-based statistics. | Visits | Resolved 2026-11-12: optional period, not part of time-based statistics, see BR-016 |
| OI-018 | Whether planned trips can have dates, or the Planned list stays a simple set of cities. | Lists | Open |
| OI-020 | How cities that are part of a municipality count in statistics and filters, for example whether "cities visited" can exclude them, and how population totals avoid counting people twice (BR-017). | Statistics | Open |
| OI-021 | How to treat OpenStreetMap settlement points that stand for a municipality which is not a settlement (for example Möhnesee): detect and drop them on import, or correct them by hand. In Germany 82 of 9,505 cities that represent their municipality are suspects: the municipality names a different settlement as its seat. | Data | Open |

---

## Appendix A. Traceability matrix

| Concept section | Requirements |
|---|---|
| Idea | §1.2, §2.2 |
| Accounts and guests | FR-AUTH-001…010, FR-PROF-001…003, FR-STAT-005 |
| Cities | BR-001, BR-017, FR-CITY-001…010, FR-SRCH-001…002, §5.2 City, §5.2 Municipality |
| Visits and dates | BR-002, BR-003, BR-011, BR-012, FR-VIS-001…009, FR-STAT-004 |
| Cities the user has lived in | BR-016, FR-VIS-010, FR-MAP-005, FR-STAT-001 |
| Rating cities | BR-005…BR-009, FR-RATE-001…008, FR-CITY-003, FR-SRCH-003 |
| Lists | BR-004, FR-LIST-001…007, FR-MAP-006, FR-SRCH-004 |
| Map and statistics | FR-MAP-001…007, FR-STAT-001…006, FR-IMP-001, BR-014 |
| Social features | FR-PROF-004, FR-SOC-001…006, FR-SRCH-005 |
| Privacy | BR-013, FR-PRIV-001…003, FR-LIST-005 |
| Photos and attachments | FR-ATT-001…002 |
| Places | BR-010, FR-PLACE-001…003 |
| Moderation | FR-MOD-001, FR-CITY-007…008 |
| Project context | §1.2, §2.3, CON-010, CON-011, NFR-L10N-001 |
| Technology | CON-001…009, FR-CITY-005, FR-MAP-001…003, §6.2, NFR-PORT |
| Monetization | BR-015, FR-AFF-001…004, NFR-GDPR-004, §8 |

## Appendix B. Place categories

To be defined. See OI-014.

## Appendix C. Rating colour scale

City ratings are shown with the following colours. Ratings between two whole numbers, such as 7.5 or a community rating of 7.83, use a colour linearly interpolated between the two neighbouring colours.

| Rating | Colour |
|---|---|
| 1 | `#5f3a74` |
| 2 | `#a44257` |
| 3 | `#e9493a` |
| 4 | `#f9951f` |
| 5 | `#f4cf3f` |
| 6 | `#8dc252` |
| 7 | `#25b464` |
| 8 | `#1f8e4f` |
| 9 | `#196839` |
| 10 | `#17a0f5` |
