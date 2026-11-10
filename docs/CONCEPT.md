# Flanr

## Idea

Flanr is an app that is in some ways similar to both Letterboxd and Strava at the same time.

There are plenty of travel apps, but none of them focuses on rating cities as such. The idea is to build an app that follows logic similar to Letterboxd, where users can rate cities by several criteria, keep track of where they have been and where they want to go, and share this with other people.

## Accounts and guests

Almost everything in Flanr can be used without an account. A guest can browse city pages, statistics across all users and other people's public profiles and lists. Registration is only needed once the user wants to do something with their own data, for example press a button to save a city. At that moment, the app offers them to sign up.

At the start, users can sign in with email and password, with email and a one-time code, or with Google. Sign in with Apple will be added only when work on the mobile apps begins. Users can change their username and their email address. Authentication will most likely be handled by Clerk, and the details will be decided when work on authentication starts.

The profile contains the usual things found in every social network, and its exact structure will be defined later. Where the user lives is optional and can be hidden.

The initial role model is the simplest standard one: regular users, moderators and administrators. The roles will be discussed in more detail later.

## Cities

In Flanr, a "city" really means any settlement. There is no minimum population: Vatican City has only around 800 inhabitants but is obviously a city, and many villages in the world have more people than that. Whether a settlement is a city, a town or a village is an additional attribute, depending on what the data source provides. A name that describes a part of another settlement, such as Wuppertal-Barmen, is not a separate city.

A city is a fairly information-rich structure, with a clear split between public information and each user's private information.

The public part comes from external data sources. Every city must have an internal ID and an ID in the source dataset, so that the data can be updated later. It must also have its local and English name, alternative names and transliterations (so that search finds both Köln and Cologne), the country, the first-level region, the coordinates of its centre, its boundaries as a polygon, the population together with the year it refers to, the settlement type, its capital status (capital of a country, of a region, or neither) and a link to Wikipedia.

Beyond that, it would be good to have the area (from which the population density can be calculated), the second-level region, the time zone, the elevation, a short description and a main photo under a free licence, the coat of arms and flag, the official website, names in other languages for future localization, the population of the metropolitan area, the year of founding or first mention, the history of the population over time, which kinds of public transport the city has (metro, tram, S-Bahn and so on), UNESCO sites in the city and twin cities. These fields are nice to have, and if no good source provides one of them, it can be left out.

Users can suggest new cities and corrections to existing city data. Like other user contributions, these go through moderation.

## Visits and dates

The user decides what counts as a visit. Some people would say that spending two or three hours walking around the centre of a city is not a visit, and others would say it is. The developer's own model, which the app may suggest as a recommendation, is roughly this: a visit means either about 24 hours in a city or a shorter stay, depending on the size of the city, as long as the person actually saw something there. An hour is not a visit to Tokyo, but a small town like Cochem can be explored in a couple of hours. A trip of several days counts every day as a separate visit, because two days in Paris give a much better picture of the city than three short stops in Essen. In this model, every 24 hours is a separate visit, which is also what makes the trip calendar work. Still, the final decision is up to the user.

A visit is more than just a date. In the spirit of Strava, a visit can have a title, a description and photos, and other users can comment on it. This part is closely tied to the social features and will be worked out in more detail later.

A visit can either have a date or not. The best option is an exact date. If the user doesn't remember it, an approximate date is better than nothing, with decreasing precision, for example only the month and year. No date at all is also allowed, because the calendar is only an optional feature.

Whether a date is required depends on when the visit happened, not on when the user enters it. Visits that happened before the user registered don't need a date, because many people won't remember the dates of their past trips, but they can still add one if they do. When a user registers, they will naturally add the visits they already have, but they can also add more undated past visits later. For example, if a user said during registration that they had been to Düsseldorf five times, they can later change that to six. Any visit that happens after the registration date must have a date.

Dates matter for all statistics that depend on time. Those statistics only use dated visits, so they cover only the period for which the user has dates. For example, someone who started tracking the dates of their trips on 1 January 2026, and before that only tracked the fact and the number of visits, will have a trip calendar that effectively starts in 2026, unless they later remember and add dates for earlier trips.

## Cities the user has lived in

Besides visits, a user can mark a city as one they have lived in. This covers both the city where they live now and cities where they lived in the past. As with visits, the user decides what "lived" means.

A city the user has lived in counts as visited and can be rated, but it doesn't need a number of visits, because counting visits to your own home city makes little sense. The user can still log separate visits to it, for example trips back after moving away. On the map and in statistics, such cities are shown in a distinct way. The city the user lives in now is the same as the home location in their profile.

## Rating cities

Ratings use a scale from 1 to 10 in steps of 0.5. A city can only be rated by a user who has visited it. Each user has a single rating per city, which they can change at any time.

A city is rated using several criteria. The initial set of criteria is architecture, urbanism, greenery (how green the city is), public transport, safety and cleanliness. This is only a starting point, and the list will definitely be extended later. The criteria are optional.

There are two kinds of overall rating. The first is the average of all the criteria the user has rated. The second is the user's own subjective overall rating of the city. The subjective rating is the main one, it is required, and it is what the app uses as the user's rating of the city. When the user sets it, the app suggests the average of the criteria as a starting value, so a user who prefers a purely mathematical average to a rating based on feelings can simply accept it.

The community rating of a city is the average of all users' ratings and is shown to two decimal places. Users can search for cities and filter and sort them by rating.

A city changes over time, and criteria such as public transport, cleanliness or safety can get better or worse in both directions. That means the community rating of a city is not quite the same thing as the average rating of a film, and old ratings may no longer reflect what the city is like today. One way to deal with this is to let users filter the community rating by date, so they can see how the city has changed. How exactly this will be implemented is still undecided.

Text reviews of cities are also planned, but it is not yet clear how they relate to visit posts in the social part of the app. This will be worked out later.

## Lists

Lists work the same way as on Letterboxd: they group cities together by some idea. Examples include "The best small half-timbered towns in Germany", "Cities with the best tram networks", or simply "Cities I want to visit again".

Every user has two default lists: visited and planned. A city can be in only one of these two lists at a time: when the user logs a visit to a city from the planned list, it automatically moves to the visited list. On top of that, users can create as many custom lists as they want. A custom list can have a description, its cities can be ordered, and each entry can have a note. Users can like and save other people's lists.

Both default and custom lists can be either public or private, and everything is public by default. Public default lists are visible through the user's profile. Public custom lists are visible through the profile and can also be found through search.

## Map and statistics

All of this information is shown on a world map with different types of visualization. There are three default visualization modes for the general statistics and for the map as a kind of personal workspace. In the first mode, markers are based on the number of visits, and both their size and colour change depending on how many times the user has been to a city. In the second mode, markers are based on the user's rating, and their colour changes depending on the rating. In the third mode, markers are based on the city's population, and both their size and colour change with it. These are only the defaults, and more modes may be added later.

Users also get various visual statistics for individual countries and regions, as well as a calendar of trips, imagined as something like GitHub's commit calendar.

Dated visits also make monthly visual statistics possible. For example, the app could show which cities were visited during a year, month by month, either by switching between months or by gradually filling in the map. This is not a high-priority feature and will be described in more detail closer to implementation.

Later, the app may also read a Google Maps Timeline export (Timeline.json). This is purely for nicer visualizations and is a feature for later. An import never creates visits, because only the user decides what counts as a visit.

## Social features

The app is also a social network. Users can see not only their own city ratings but also the community ratings, which may influence their opinion of a city or their plans to visit it.

Users can add each other as friends. Since friends see each other's posts, a friend request probably has to be accepted. Users can see their friends' activity in a feed, or open a friend's profile to see all of their completed and planned trips.

The feed works like the one on GitHub and contains all kinds of activity: visits, ratings, lists and so on. It also includes news from the app itself, for example "this list is gaining popularity" or "this city has been rated better recently than before, maybe you want to visit it again". Activity can be liked and commented on. Notifications, such as replies to comments and new friends, also go into the feed, which can be filtered.

The social part is the least worked-out area so far and will be discussed in detail later.

## Privacy

A profile can be either public or private as a whole. There is no separate visibility setting for individual visits or ratings. Ratings from private profiles still count towards the community rating of a city.

## Photos and attachments

Users can add attachments to a city, for example photos. To become part of the city's public photos, they must first be approved by a moderator. Limits on photos will be defined later.

## Places

Another important part is the ability to add places to cities. These can be landmarks, cultural sites, entertainment, infrastructure, various venues and shops. The categories are defined by the developer, and there should be as many of them as possible to cover everything users find interesting. The list of categories is still to be defined.

Users can contribute such places by attaching them to specific cities. Adding a place publicly requires a moderator's approval. A place is essentially a point on the map with a name and some basic information, and its exact fields will be defined later.

Places can also be rated, so that people can see which places matter most in a given city. Unlike cities, a place has a single rating on a scale from 1 to 5, with no separate criteria, and a user does not need to have visited the city to rate a place in it.

## Moderation

Moderation covers photos, places and suggested changes to city data. How exactly it works will be decided later.

## Project context

Flanr is developed as a personal startup, first of all because the developer needs such an app himself, and because it seems possible to turn it into a small business. It starts as a non-commercial project. It will also be the basis of a university diploma project, but the diploma is a side quest: it will be written based on what exists in the product, and the aim is to avoid the diploma dictating the product's requirements.

At the start, the expected scale is around one to five users. The interface is in English first, and localization will be added later.

## Technology

Flanr is planned as a fullstack TypeScript project with a Next.js web frontend and the backend as a separate standalone API, because a mobile app is a must-have. The web frontend needs server-side rendering, and since the backend is separate, it acts as an SSR client of the API. Next.js is the current choice because it is familiar, mature and well supported by the other parts of the stack. TanStack Start is still being considered as an alternative.

The backend is written in TypeScript with Hono. TypeScript was chosen over Go because most of the code will be written with AI assistance and then reviewed by the developer, who can review TypeScript confidently. The performance benefits of Go don't matter at the current scale, and heavy geographic work is done by the database anyway. The API is described with OpenAPI, which is the source of truth for the contract, so the backend can still move to Go in the future without changing the clients. The database is PostgreSQL with PostGIS, accessed through Drizzle. The code lives in a monorepo with packages for the web app, the API and shared types and schemas, and later the mobile app. The web app comes first, without offline support. An Android app follows later, and an iOS app only if the project ever shows real commercial potential.

The main source of cities and their boundaries is OpenStreetMap. Settlements are taken from objects tagged as a city, town, village or hamlet, together with their administrative boundaries. This also handles parts of cities, because those are tagged as suburbs or boroughs and are therefore excluded. The remaining fields come from Wikidata, linked to OpenStreetMap through the Wikidata ID. To avoid processing the whole of OpenStreetMap from the start, a ready-made extract such as the Geoapify localities dataset or Overture Maps Divisions can be used as a starting point. Some small settlements in OpenStreetMap have no boundaries mapped. OpenStreetMap data is licensed under ODbL, which requires attribution and has share-alike conditions for distributing the database itself, while Wikidata is CC0.

The base map is Mapbox, which within its free tier provides good quality, country borders and labels, a standard and a satellite style, and a globe view both on the web and on Android. Clickable cities and their boundaries are not taken from the base map but drawn as Flanr's own layer on top of it, built from its own database. A possible fallback is MapLibre with free open tiles, which becomes more attractive once MapLibre Native supports a globe view. Because the city layer is Flanr's own, switching the base map would only affect the base map itself.

## Monetization

Monetization is not a priority right now, but there is a working direction that is not set in stone.

The main idea is unobtrusive affiliate offers on city pages. Somewhere lower on the page, the user is offered to look at accommodation in the city and, later, to plan a route there. Accommodation is the only part that can bring real money, so the starting point is an accommodation aggregator rather than individual booking sites, for example an embedded map of stays in the city that covers several providers at once. Transport, such as Omio or FlixBus, may be added in the future, mainly for the user's convenience rather than for income. Tours and activities, for example GetYourGuide, are an important addition and fit naturally with the places in a city.

The strongest signal that a user is really going to travel is the planned list, since most users will mostly log trips they have already made. That makes cities in the planned list the most relevant place for such offers. Affiliate tracking also has to respect GDPR cookie consent.

A paid subscription is possible as a concept for the future, but it is not planned for now. If it ever exists, it may include part of the advanced visual statistics. A subscription will never limit the core functionality, for example the number of visited cities. Everything that people use the app for must stay free.
