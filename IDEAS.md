# Ideas

Pilot Debug's runway: ideas collected over the years, parked here until they're ready to
come to life. Each `## ` heading is one idea. The paragraph under it is the pitch, and these
optional lines describe it:

- `Status:` one of `raw` (needs shaping), `shaped` (clear enough to build), `exists`
  (it's out there already, so look for the angle that's left), or `building` (now a project).
- `Category:` one of Making, Aviation & drones, Cars & mobility, Home & robotics,
  Gaming & esports, Social & civic, Money & markets, Services & work.
- `Prior art:` what already exists. `Angle:` what's still open.
- `First slice:` the smallest piece we could prototype here in the Hangar.
- `Project:` the `projects/` slug once it's being built. `Tags:` comma-separated.

Prior-art notes were written from general knowledge; check them before betting on one.

## Idea-to-object workshop

A DIY system that pairs software with automated hardware (3D printer, CNC, laser, maybe
welding) so anyone can go from an idea to a physical thing. You describe it and adjust a
parametric design; the system checks it can be made, then sends it to your own machine or
a fab service. The hard, unsolved step for most people is idea → manufacturable design.

Status: building
Category: Making
Prior art: Bambu Lab (easy printers with an app ecosystem), Glowforge (laser cutter with beginner-friendly cloud software), desktop CNCs like Carvera, and online fabs such as SendCutSend and Xometry that make parts from finished files.
Angle: Nobody owns the "describe it → parametric model → made" loop. Parametric CAD is code, so Claude can write it.
First slice: Part Studio — parametric flat parts (plates, brackets, instrument-panel cutouts) with a live 2D preview and DXF export for laser/CNC services.
Project: part-studio
Tags: manufacturing, 3d-printing, cnc, ai

## ChoreBot

A home robot that takes chores off your plate. Open question: one general-purpose robot,
or a set of single-purpose machines that each own one chore (see the dryer and dishwasher
pipeline ideas)?

Status: raw
Category: Home & robotics
Prior art: Robot vacuums and mops (Roomba, Roborock) are mainstream; general-purpose home humanoids are in development but not in homes yet.
First slice: Chore breakdown tool — list your chores, split each into robot steps, and score how hard each step is to automate.
Tags: robotics, home

## Network navigation to reduce traffic

Route drivers for the whole network, not just themselves: spread cars across routes so
total delay drops. Selfish routing can make everyone slower (Braess's paradox);
coordinated routing avoids that.

Status: shaped
Category: Cars & mobility
Prior art: Waze and Google Maps route around congestion but optimise each driver on their own; system-optimal routing is mostly research.
First slice: Traffic simulator on a small road grid comparing selfish vs coordinated routing, with total delay for each.
Tags: traffic, simulation

## Valet autopilot

Your car drops you at the door, parks itself, and comes back when called.

Status: exists
Category: Cars & mobility
Prior art: Tesla Smart Summon; Mercedes and Bosch's Intelligent Park Pilot (driverless valet parking in a Stuttgart airport garage).
Angle: Garage-side infrastructure (sensors plus guidance) that valets any compatible car, instead of each car doing it alone.
First slice: Parking-garage valet simulator — plan a car's path to the nearest open spot and back.
Tags: autonomy, parking

## Autopilot adaptation for old cars

Bring driver assistance to cars that never had it.

Status: exists
Category: Cars & mobility
Prior art: comma.ai's openpilot adds lane-keeping and adaptive cruise to many cars, but only ones that already have electronic steering and radar cruise (roughly 2016 onward).
Angle: Truly old cars need steering, throttle, and brake actuators, which is a hard, heavily regulated retrofit.
First slice: Retrofit readiness checker — which capabilities (drive-by-wire throttle, electric power steering, radar cruise) a car has, and what it would need.
Tags: autonomy, retrofit

## Smart home tech that learns your trends

A home that notices your routines and automates them without you writing rules.

Status: exists
Category: Home & robotics
Prior art: Nest Learning Thermostat, Google and Alexa routines, Home Assistant automations.
Angle: Privacy-first, fully local learning that proposes automations from your own event history.
First slice: Pattern finder — load a home event log (sample data included), detect recurring patterns, suggest automations.
Tags: home, ml

## Hybrid rover with rechargeable copter

A ground rover that carries a scout drone, launches it, and recharges it on board.

Status: exists
Category: Home & robotics
Prior art: NASA's Perseverance rover and Ingenuity helicopter on Mars (Ingenuity charged from its own solar panel, not the rover).
Angle: An Earth version for search and rescue, farms, or surveying, where the rover is the drone's charger and truck.
First slice: Mission planner — rover route plus drone sorties within battery range, on a map grid.
Tags: robotics, drones

## Social media for gamers

A social network built around gaming.

Status: exists
Category: Gaming & esports
Prior art: Discord, Twitch, Steam Community — a very crowded space.
Angle: Only a sharp niche gets in, like finding teammates by skill, role, and schedule (overlaps with personalised matchmaking).
First slice: Teammate finder — filter players by game, role, rank, and when they play.
Tags: gaming, social

## Bidding site for programmer/robotics projects

Post a project and let builders bid on it.

Status: exists
Category: Services & work
Prior art: Upwork and Freelancer.com for software, with bid-based hiring.
Angle: Hardware and robotics projects are underserved: they need specs, parts lists, and shipping physical prototypes. Pairs with the idea-to-object workshop.
First slice: Project brief builder — turn a rough idea into a biddable spec with milestones and acceptance tests.
Tags: marketplace, robotics

## Esport amateur LAN event setup

A turnkey kit and service for amateur LAN tournaments: network, power, seating, brackets,
and streaming.

Status: shaped
Category: Gaming & esports
Prior art: Tournament software such as start.gg and Challonge; full "event in a box" for amateurs is rarer.
First slice: LAN planner — player count → power circuits, switch ports, bandwidth, table layout, and a bracket.
Tags: esports, events

## AR glasses for fashion/esports in warehouse

Several ideas in one: AR try-on for fashion, AR esports arenas in big warehouse spaces, or
AR glasses for warehouse work. Open question: which one leads?

Status: raw
Category: Gaming & esports
Prior art: Free-roam VR arenas (Sandbox VR, Zero Latency), AR pick-by-vision glasses in logistics, virtual try-on in shopping apps.
First slice: Shape it first; for the arena version, a warehouse arena layout planner.
Tags: ar, esports

## Python trading bot

An automated trading bot with backtesting, plus a compact watchlist with sparklines.

Status: exists
Category: Money & markets
Prior art: Open-source frameworks (Freqtrade, backtrader) and platforms (QuantConnect, Alpaca's API).
Angle: The edge is in the strategy and the risk discipline, not the bot. A clear backtester that keeps you honest is the useful part.
First slice: In-browser backtester on bundled sample prices — strategy rules, equity curve, drawdown. Live quotes later need a small serverless function to keep the API key off the page.
Tags: finance, trading

## Smart suspension

Suspension that adapts to the road in real time.

Status: exists
Category: Cars & mobility
Prior art: Magnetorheological dampers (MagneRide), camera-based predictive suspension (Mercedes Magic Body Control), semi-active motorcycle suspension.
Angle: Affordable aftermarket semi-active kits for motorcycles or off-road.
First slice: Quarter-car suspension simulator — tune spring rate and damping, watch the response to a bump.
Tags: cars, simulation

## CSGO real life bot

Counter-Strike-style bots in real life. Open question: is it robot opponents in a laser-tag
arena, or a physical aim-training system?

Status: raw
Category: Gaming & esports
Prior art: Laser tag arenas; autonomous robotic targets used in marksmanship training.
First slice: Arena bot AI sandbox — top-down map where bots patrol, take cover, and react.
Tags: gaming, robotics

## Autonomous car with surveying capability

A vehicle that maps and surveys as it drives.

Status: exists
Category: Cars & mobility
Prior art: Mobile mapping systems (Leica Pegasus, Trimble MX) and street-view mapping cars.
Angle: A low-cost version for small survey firms, or road-condition monitoring (potholes) from phone sensors.
First slice: Pothole mapper — detect bumps in a phone accelerometer trace and pin them on a map.
Tags: mapping, autonomy

## Robot to clean up environment, use as fuel?

A robot that collects litter or plastic and turns it into the energy that powers it. Open
question: does the energy math close? Can waste collected per hour run the robot?

Status: raw
Category: Home & robotics
Prior art: The Ocean Cleanup, beach-cleaning robots, waste-to-energy plants.
First slice: Energy budget calculator — waste collected per hour × energy content × conversion efficiency vs the robot's power draw.
Tags: robotics, environment

## Blockchain for cars

A tamper-proof history for each car: mileage, maintenance, accidents.

Status: exists
Category: Cars & mobility
Prior art: The MOBI consortium's vehicle identity standards; Carfax already centralises history.
Angle: An owner-held, tamper-evident logbook. Open question: does it need a blockchain, or are signed records enough?
First slice: Signed maintenance logbook — entries signed with a key and verifiable by a buyer, no chain required.
Tags: cars, crypto

## Logbook digitizer

Photograph every page of a paper pilot logbook and get back a file ForeFlight (or any
electronic logbook) imports, instead of spending weekends retyping years of entries.

Status: building
Category: Aviation & drones
Prior art: iOS scanner apps (TopLog, LogbookScan, FlightLogScan) read handwritten pages with AI and export CSV; ForeFlight publishes an import template; paid transcription services retype logbooks by hand.
Angle: Web-based, nothing to install, pay-per-page instead of a subscription, and it uses the page's own "totals this page" line to catch misreads so you check a few flagged cells instead of every row.
First slice: Ferry Flight — upload page photos, Claude reads them (bring your own API key), review flagged rows against page totals, export ForeFlight's import CSV.
Project: ferry-flight
Tags: aviation, logbook, ai, ocr

## Acrobatic autopilot

An autopilot that flies aerobatic sequences precisely, for training, airshows, or drones.

Status: shaped
Category: Aviation & drones
Prior art: Research on aggressive quadrotor and fixed-wing flight (ETH Zurich, MIT); ArduPilot supports scripted aerobatics for planes.
First slice: Aerobatic sequence designer — chain loops, rolls, and Cuban eights, and preview the flight path in 3D.
Tags: aviation, autopilot

## Freelance drone pilot/programmer

Drone flying for hire combined with custom software: mission scripts and data processing.

Status: exists
Category: Services & work
Prior art: Drone pilot marketplaces such as Zeitview (formerly DroneBase) and Droners.io.
Angle: Pilots who can also program the mission and the deliverable stand out.
First slice: Drone job quote calculator — area, altitude, and overlap → flight time, photo count, and price.
Tags: drones, freelance

## Automatic windows/blinds to control temp

Windows and blinds that open and close to keep the house comfortable with less HVAC.

Status: exists
Category: Home & robotics
Prior art: Smart blinds (Lutron Serena, IKEA, SwitchBot retrofit motors); automatic greenhouse vent openers.
Angle: The brain, not the motor: deciding when to open windows vs run AC using the forecast.
First slice: Open-window-or-AC advisor — indoor/outdoor temperature and forecast → recommended schedule.
Tags: home, energy

## Autofolding dryer with dresser pipeline

Clothes go from the dryer to folded and sorted into drawers automatically.

Status: exists
Category: Home & robotics
Prior art: FoldiMate and Laundroid both tried this and shut down; folding arbitrary clothes is very hard.
Angle: Learn from their failures, and start narrow (towels and T-shirts only).
First slice: Folding move-set visualiser for a T-shirt — the exact sequence of moves a folder must perform.
Tags: home, robotics

## Dishwasher cabinet pipeline

A dishwasher that is also the cabinet: clean dishes stay where they are, dirty ones go in,
and nobody unloads anything.

Status: raw
Category: Home & robotics
Prior art: Dish-drawer dishwashers; some kitchens run two dishwashers alternately for the same effect.
First slice: Kitchen workflow model — minutes a year spent loading and unloading, and what the pipeline saves.
Tags: home

## Home defense drone

A drone that patrols the home and responds to intruders. Keep it to watch, deter (light
and siren), and alert. Arming it is a legal non-starter.

Status: exists
Category: Aviation & drones
Prior art: Ring Always Home Cam (indoor security drone), Sunflower Labs (outdoor security drone).
First slice: Patrol planner — draw a floor plan, set a patrol route, see camera coverage and blind spots.
Tags: drones, security

## DMV website decentralized/open source news

Two ideas on one line: (a) an open-source, far better DMV experience, and (b) decentralised,
open-source news. Open question: split them?

Status: raw
Category: Social & civic
Prior art: Civic-tech rebuilds of government services (Code for America); federated social media (Mastodon) and community fact-checking.
First slice: DMV task wizard — answer a few questions, get the exact documents and steps for your task.
Tags: civic, open-source

## Platform for third world or dictatorship

Tools for people with poor connectivity or living under censorship: information,
communication, commerce. Open question: which single need comes first?

Status: raw
Category: Social & civic
Prior art: Tor, Briar (mesh messaging), M-Pesa (mobile money), satellite internet.
First slice: Offline-first app shell that works with no connection and syncs when one appears.
Tags: civic, offline

## Coordinated street lights with cars

Traffic signals and cars that talk, so you hit green waves instead of red lights.

Status: exists
Category: Cars & mobility
Prior art: Adaptive signal control (SCATS, SCOOT); Audi's Traffic Light Information shows a countdown to green.
Angle: Speed advisory for the green wave, for any car, from a phone.
First slice: Green-wave simulator — signal timings along a corridor and the speed that makes every green.
Tags: traffic, simulation

## Disability support robot

A robot that helps people with disabilities in daily life. Open question: which disability
and which tasks? Scope decides everything.

Status: raw
Category: Home & robotics
Prior art: Assistive robot arms (Kinova JACO), feeding robots (Obi), research on robotic guides.
First slice: Needs-mapping tool — daily tasks × difficulty → what assistive tech already exists for each.
Tags: robotics, accessibility

## Driving score

Score how well you drive, trip by trip.

Status: exists
Category: Cars & mobility
Prior art: Insurance telematics (Progressive Snapshot, State Farm Drive Safe & Save); Tesla's Safety Score.
Angle: A private coach that helps you improve, not an insurer watching you.
First slice: Trip scorer — harsh braking, speeding, and cornering from a phone GPS/accelerometer log (sample data).
Tags: cars, telematics

## Motorcycle uber

Ride-hailing on motorcycles: faster through traffic.

Status: exists
Category: Cars & mobility
Prior art: Motorbike taxis through Gojek, Grab, Rapido, and Uber Moto in several countries.
Angle: US regulation and insurance are the barrier; niches like event traffic might work first.
First slice: Moto vs car comparison — fare and time for a trip in traffic.
Tags: mobility, motorcycle

## Temperature controlled clothing

Clothing that heats or cools you on demand.

Status: exists
Category: Home & robotics
Prior art: Battery-heated jackets and gloves, Sony's Reon Pocket wearable cooler, liquid-cooled vests for racers.
Angle: Heating and cooling in one garment for motorcyclists and pilots.
First slice: Heat-balance calculator — activity, ambient temperature, and clothing → watts needed and battery life.
Tags: wearables

## Open source online education

Free, open education for anyone.

Status: exists
Category: Social & civic
Prior art: Khan Academy, MIT OpenCourseWare, freeCodeCamp, Wikipedia.
Angle: Niche curricula nobody covers well, e.g. building and flying experimental aircraft or drones.
First slice: Course builder — markdown lessons plus quizzes, published as a static site.
Tags: education, open-source

## Open source problem solving / legislature

Solve public problems and draft laws in the open, like open-source software.

Status: exists
Category: Social & civic
Prior art: vTaiwan and Pol.is (consensus mapping), Decidim (participatory democracy), Kialo (structured debate).
Angle: Law as code: bills with diffs, issues, and pull requests.
First slice: Bill viewer — versions with diffs and inline comments.
Tags: civic, open-source

## AI produces chemical compounds and effects

AI that proposes compounds and predicts their effects.

Status: exists
Category: Services & work
Prior art: AI drug discovery (Insilico Medicine, Isomorphic Labs) and protein structure prediction (AlphaFold).
Angle: A learning tool for exploring known, public compounds and their properties.
First slice: Molecule explorer — structure drawing and basic properties for known compounds.
Tags: science, ai

## Smart motorcycle lights

Lights that react to how you ride: lean-aware headlights and automatic brake flashing.

Status: exists
Category: Cars & mobility
Prior art: Adaptive cornering headlights (BMW, KTM), flashing brake-light modules.
Angle: An affordable aftermarket kit that reads lean and deceleration from an IMU.
First slice: Lean-angle light simulator — speed and turn radius → lean angle → which light segments turn on.
Tags: motorcycle, lighting

## Esport summer bootcamp

A summer camp for competitive gaming: coaching, scrims, and teamwork.

Status: exists
Category: Gaming & esports
Prior art: Collegiate esports camps and esports academies.
Angle: A packaged curriculum and operations kit; pairs with the LAN event setup.
First slice: Camp planner — daily schedule, coaching blocks, scrims, and budget per camper.
Tags: esports, education

## Hang glider autopilot

Stability and guidance assistance for hang gliders. Open question: hang gliders steer by
weight shift, so does it actuate anything, or guide the pilot?

Status: raw
Category: Aviation & drones
Prior art: Soaring flight computers with thermal assistants (XCSoar), autonomous paraglider cargo drones.
First slice: Thermal centring assistant — from a variometer trace, suggest which way to turn and how much.
Tags: aviation, gliding

## Deployment FPS 3-3-1 7v7

An FPS game mode: two 7-player teams deploy in a 3-3-1 formation. Open question: what does
each group do, and what's the win condition?

Status: raw
Category: Gaming & esports
Prior art: Battlefield squads, Hell Let Loose's commander role.
First slice: Game-mode design doc plus a top-down tactics board for the 3-3-1 formation.
Tags: gaming, game-design

## Heated windshield wipers

Wipers that don't freeze.

Status: exists
Category: Cars & mobility
Prior art: Heated wiper blades and heated wiper-rest areas, sold as OEM options and aftermarket.
Angle: Parked — only interesting as part of a smart windshield.
Tags: cars

## Show/series follower/schedule generator

Track the shows you watch and plan when to watch them.

Status: exists
Category: Social & civic
Prior art: TV Time, Trakt, JustWatch.
Angle: A binge planner that fits episodes into your actual free time.
First slice: Binge planner — shows, episode lengths, and free evenings → a schedule.
Tags: media

## Solar commercial plane

An airliner powered by the sun. Open question: can physics ever close the gap? Sunlight
per square metre of wing is far below what an airliner needs.

Status: raw
Category: Aviation & drones
Prior art: Solar Impulse 2 flew around the world with one pilot at low speed; solar high-altitude drones.
First slice: Solar flight feasibility calculator — wing area, cell efficiency, weight, and L/D → power needed vs available.
Tags: aviation, energy

## Shared experiences - pins and paths

Share places and routes with the stories behind them.

Status: exists
Category: Social & civic
Prior art: AllTrails, Strava routes, Google Maps lists, Polarsteps.
Angle: Pins and paths for a community, e.g. pilots sharing fly-in trips and airport food stops.
First slice: Map journal — drop pins and draw paths with notes, share by link.
Tags: maps, social

## Online discourse software

Better online discussion: structured, less shouting, surfaces agreement.

Status: exists
Category: Social & civic
Prior art: Kialo (argument maps), Pol.is (consensus finding), Reddit.
First slice: Argument map editor — claims with pros and cons, nested and weighted.
Tags: social, civic

## Automated sensor lights

Lights that turn on when you're there.

Status: exists
Category: Home & robotics
Prior art: Motion-sensor lights; smart bulbs with motion sensors (Philips Hue).
Angle: Presence rather than motion, using mmWave sensors, so lights stay on while you sit still.
Tags: home, lighting

## 3d printer with fault detection, bed clearing for reprints, multiple filament options w/ switching

A printer that notices failures, clears the bed, and reprints automatically, with
multi-filament switching.

Status: exists
Category: Making
Prior art: Bambu Lab printers (AI failure detection, AMS multi-filament switching), Prusa's MMU, automatic part-ejection add-ons and belt printers for continuous printing.
Angle: The full print-farm loop (detect → clear → reprint, unattended) is the least solved part, and it's a building block of the idea-to-object workshop.
First slice: Print-farm simulator — queue, failure rate, and auto-retry → throughput and wasted filament.
Tags: 3d-printing, automation

## Crypto ATM n card

Buy crypto at an ATM and spend it by card.

Status: exists
Category: Money & markets
Prior art: Bitcoin ATMs and crypto debit cards (e.g. Coinbase Card).
Angle: Parked — it's been built.
Tags: crypto

## Fully integrated flight computer with vision

A flight computer that sees: runway, traffic, and terrain from cameras, integrated with
the rest of the avionics.

Status: exists
Category: Aviation & drones
Prior art: Garmin Autoland; Daedalean's vision-based landing guidance; integrated EFIS for experimentals (Dynon, Garmin G3X).
Angle: A vision add-on for experimental aircraft: runway and traffic detection feeding an existing EFIS.
First slice: Approach visualiser — glidepath, aim point, and what a nose camera sees at each distance.
Tags: aviation, vision

## Social media that connects people, points for helping

Connect people who need help, goods, or services with people who can provide them,
decentralised, with points for helping.

Status: exists
Category: Social & civic
Prior art: Nextdoor, Buy Nothing groups, timebanking networks.
Angle: Portable reputation for helping that you own, rather than one platform owning it.
First slice: Help board — requests and offers with a points ledger.
Tags: social, community

## Mobile 3D printer

A 3D printer that goes to the job. Open question: at what scale? Construction, field
repairs, or a printer in your vehicle?

Status: raw
Category: Making
Prior art: Construction 3D printing (ICON), mobile printing robots in research, 3D printers on the ISS.
First slice: Field repair planner — which common parts a portable printer can make, and how long each takes.
Tags: 3d-printing

## Personalized match making games

Matchmaking that pairs players on more than skill: playstyle, attitude, and schedule.

Status: exists
Category: Gaming & esports
Prior art: Skill-based matchmaking (Elo, TrueSkill) is standard in online games.
Angle: Matching on playstyle and personality, not just rank.
First slice: Matchmaking playground — ratings plus playstyle vectors, see who gets matched with whom and why.
Tags: gaming, algorithms

## Adjustables monitor with auto resolution

A monitor that moves itself to fit you and scales its display to how far away you are.
Open question: which matters more, the motion or the scaling?

Status: raw
Category: Home & robotics
Prior art: Motorised monitor arms, OS display scaling, monitors with presence sensors.
First slice: Viewing-distance calculator — distance and screen size → ideal scaling and text size.
Tags: hardware, ergonomics

## Person missle launch to glider

Launch a person-carrying glider to altitude with a rocket or catapult boost instead of a
towplane or winch. The limit is g-load on the pilot.

Status: raw
Category: Aviation & drones
Prior art: Winch and bungee glider launches; rocket-assisted takeoff (RATO/JATO) historically.
First slice: Launch calculator — launch energy, peak g-load, and altitude gained.
Tags: aviation, gliding

## Traffic app to send notification when normal route is slower

Get a heads-up when your usual route is slower than normal.

Status: exists
Category: Cars & mobility
Prior art: Google Maps and Waze commute alerts do this.
Angle: Parked — built into the big map apps.
Tags: traffic

## Remote drone CG adjusting mechanism

An actuated battery or ballast slider that shifts a drone's CG for different payloads, on
the bench or in flight.

Status: shaped
Category: Aviation & drones
Prior art: Sliding battery trays on some RC aircraft; research on active CG control.
First slice: CG calculator — components and their positions → CG, and how far the slider must move for each payload.
Tags: drones, cg

## Hybrid SAAS

Open question: what's the hybrid? Software plus humans doing a service behind it, or
cloud plus self-hosted?

Status: raw
Category: Services & work
First slice: Shape it first.
Tags: business, software

## Take pixhawk and design new hardware that adds ports between FCs to do diff EQ and master slave redundancy

A carrier board that links two or three Pixhawk-class flight controllers so they
cross-check each other (voting, master/slave failover).

Status: building
Category: Aviation & drones
Prior art: The Cube and Pixhawk have redundant IMUs inside one controller; commercial multi-redundant autopilots exist; open-source multi-FC failover is niche.
First slice: Voting and failover simulator — three FCs report attitude; inject faults and see which one is trusted and when.
Project: fc-voter
Tags: drones, redundancy, pixhawk

## Experimental aircraft test flight

A Phase I flight-test planner and log for amateur-built aircraft: test cards, envelope
expansion, and hours toward the Phase I requirement.

Status: shaped
Category: Aviation & drones
Prior art: EAA flight-test guidance and builders' own spreadsheets; dedicated apps are thin.
First slice: Test card builder and Phase I hours tracker (pairs with the Kit Build Log). Plans come from the builder, not the app.
Tags: aviation, bearhawk

## Low altitude adsb on helium network

Crowdsourced receivers covering low altitudes (drones, helicopters, GA) where ADS-B coverage
is thin, rewarded like Helium hotspots. Open question: does a token add anything over
existing volunteer feeder networks?

Status: raw
Category: Aviation & drones
Prior art: ADS-B Exchange and FlightAware's PiAware (volunteer receiver networks); Helium's reward-for-coverage model.
First slice: Coverage-gap mapper — receiver locations → estimated low-altitude coverage.
Tags: aviation, adsb

## Defi swap for tangible goods

Swap physical goods peer-to-peer, with on-chain escrow. Open question: the physical handoff
can't be enforced on-chain, so what guarantees delivery?

Status: raw
Category: Money & markets
Prior art: Tokenised real-world assets; escrow marketplaces.
First slice: Escrow state machine — a barter trade walked through every state, including disputes.
Tags: crypto, marketplace

## Wireless wire continuity/ same cable tester

Two small units clip to each end of a wire or harness and report continuity, and which
conductor is which, wirelessly. No long test leads through the airframe.

Status: shaped
Category: Making
Prior art: Network cable testers with remote units; tone-and-probe wire tracers.
Angle: Wireless, multi-conductor harness identification for aircraft and car wiring.
First slice: Harness checklist — import a wire list, check off each conductor end to end.
Tags: electronics, aviation

## Smart windshield

A windshield that displays information: navigation, hazards, instruments.

Status: exists
Category: Cars & mobility
Prior art: Head-up displays and AR HUDs from BMW, Mercedes, and others.
Angle: A HUD for experimental aircraft.
First slice: HUD layout mock-up — place symbology over a cockpit view.
Tags: cars, hud

## Car battery saver

Stop a car sitting unused from draining its battery.

Status: exists
Category: Cars & mobility
Prior art: Low-voltage disconnect switches and battery tenders.
Angle: A smart version that alerts your phone and cuts parasitic drain before a no-start.
First slice: Drain calculator — battery capacity and parasitic draw → days until no-start.
Tags: cars

## Software engineer contracting team

A small contracting team for software projects: a business rather than a product.

Status: shaped
Category: Services & work
Prior art: Agencies and dev shops.
Angle: A niche specialism, e.g. aviation, drone, and robotics software.
First slice: Services page with a project estimator.
Tags: business

## UAV or robot that changes shape such as wing

A drone or robot that reshapes itself, e.g. a morphing wing, for different phases of flight.

Status: building
Category: Aviation & drones
Prior art: Slats and Fowler flaps (Storch, Helio Courier, SuperSTOL); telescoping wings (MAK-10, 1931); variable sweep (F-14, F-111); NASA/FlexSys FlexFoil seamless flaps; lift+cruise and tiltrotor VTOL (V-22, Beta Alia; Lilium and Volocopter went insolvent).
Angle: Pick the shape per flight phase: retractable slats for a Bearhawk, a wing that cruises small and lands big, or lift rotors for VTOL. Pairs with the foil optimiser.
First slice: Shape-per-phase explorer — cruise vs climb vs landing wing settings and their trade-offs.
Project: morph-wing
Tags: aviation, morphing

## Foil to optimize for desired flight characteristics

Choose the characteristics you want (lift, drag, stall behaviour) and search for airfoil
shapes that deliver them.

Status: building
Category: Aviation & drones
Prior art: XFOIL and airfoiltools.com.
First slice: Airfoil explorer — NACA 4-digit generator with thin-airfoil lift estimates, compare shapes side by side.
Project: airfoil-lab
Tags: aviation, aero

## Pair or triplet of surveillance drones auto land recharge takeoff

Two or three drones that take turns: one flies while the others recharge, for continuous coverage.

Status: exists
Category: Aviation & drones
Prior art: Drone-in-a-box systems (Skydio Dock, Percepto) with automatic landing and charging.
Angle: Rotation of several drones for unbroken coverage.
First slice: Rotation scheduler — flight time, charge time, and number of drones → coverage timeline with gaps.
Tags: drones

## Personal flying drone with ground effect

A personal craft that flies in ground effect, just above water or flat ground. Open question:
how is it regulated, and is it a boat or an aircraft?

Status: raw
Category: Aviation & drones
Prior art: Wing-in-ground-effect craft (Regent's seagliders, historical ekranoplans); personal eVTOLs such as Jetson One.
First slice: Ground-effect calculator — induced drag reduction vs height over span.
Tags: aviation, ground-effect

## Weight & balance for the Bearhawk

Enter empty weight and arm from the weighing, then pilot, passengers, fuel, and baggage;
plot the CG on the envelope and flag out-of-limits loadings. Needs your aircraft's real
numbers, so the prototype ships with obviously fake placeholders.

Status: shaped
Category: Aviation & drones
First slice: W&B calculator with an envelope plot and placeholder numbers you replace.
Tags: aviation, calculator, suggested

## METAR decoder

Paste a raw METAR/TAF and get a plain-English breakdown, with flight category colouring
(VFR/MVFR/IFR/LIFR) and the crosswind for a chosen runway.

Status: shaped
Category: Aviation & drones
First slice: METAR decoder with flight category and crosswind (reusing the E6B maths).
Tags: aviation, weather, suggested

## Preflight checklist trainer

Flashcard-style drills for checklists and memory items, with spaced repetition so the
ones you miss come back sooner.

Status: shaped
Category: Aviation & drones
First slice: Checklist drill app with spaced repetition and your own checklists.
Tags: aviation, learning, suggested

## Build-task board

Kanban for the kit build: backlog of manual steps, in progress, waiting on parts, done,
with each card linking to the matching Build Log sessions.

Status: shaped
Category: Aviation & drones
First slice: Kanban board that reads and writes the Kit Build Log's data.
Tags: aviation, tracker, bearhawk, suggested
