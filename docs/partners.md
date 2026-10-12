# Charla: a one-pager for places / una hoja para los negocios

Print this two-up. Hand the Spanish side to the person at the counter and the
English side to the manager, or the other way round. The ask takes two minutes.
Before printing, replace "(see src/contact.ts)" with the address set there.

---

## English

**Charla** is a free app built by students in Naperville for the 2026
Congressional App Challenge. It helps Spanish speakers who are learning English
rehearse one real conversation (a pharmacy refill, ordering at the counter,
checking in at a clinic) and then go have it at a real place nearby.

**What we are asking:** permission to list your business on the app's map as a
place where staff will be patient with someone practicing their English. That
is the whole commitment. No sign, no training, no app on your side.

**What the listing shows:**

- your business name, address and type
- which languages your staff can help in (Spanish, English or both)
- the **role** and **shift** where a learner is most likely to find help, for
  example "cashier, afternoons". Never a name. Never a photo of a person.

**What learners see and do:** the app gives them a card with their phrases
and one line to show you: *"I'm practicing my English. Please speak a little
more slowly."* After the visit they tap "I went" once. That tap is anonymous
and only counts; it never carries a name, a location or a review.

**What we never collect or show:** employee names, customer names, photos,
star ratings, free-text reviews, anyone's location.

**Changing or removing the listing:** email us at the address below or tell
any team member. We remove a listing the same day, no questions.

Team contact: (see src/contact.ts)  (email)

☐ Yes, list us.   Name of business: __________________________________

Languages at the counter: ☐ Spanish ☐ English    Role / shift: _______________

Signed (owner or manager): ________________________   Date: _______________

---

## Español

**Charla** es una aplicación gratuita hecha por estudiantes de Naperville para
el Congressional App Challenge 2026. Ayuda a personas que hablan español y están
aprendiendo inglés a ensayar una conversación real (recoger una receta, pedir
en el mostrador, registrarse en una clínica) y luego tenerla de verdad en un
lugar cercano.

**Lo que pedimos:** permiso para poner su negocio en el mapa de la aplicación
como un lugar donde el personal tiene paciencia con alguien que practica su
inglés. Ese es todo el compromiso. Sin letrero, sin capacitación, sin
nada que instalar de su lado.

**Lo que muestra el registro:**

- el nombre, la dirección y el tipo de negocio
- en qué idiomas puede ayudar el personal (español, inglés o los dos)
- el **puesto** y el **turno** donde es más fácil encontrar ayuda, por ejemplo
  "cajero, por las tardes". Nunca un nombre. Nunca la foto de una persona.

**Lo que ven y hacen quienes aprenden:** la aplicación les da una tarjeta con
sus frases y un mensaje para mostrarle a usted: *"I'm practicing my English.
Please speak a little more slowly."* Después de la visita tocan "Fui" una vez.
Ese toque es anónimo y solo suma al conteo; nunca lleva un nombre, una ubicación ni
una reseña.

**Lo que nunca recopilamos ni mostramos:** nombres de empleados, nombres de
clientes, fotos, calificaciones con estrellas, reseñas escritas, la ubicación
de nadie.

**Para cambiar o quitar el registro:** escríbanos al correo de abajo o dígale a
cualquier integrante del equipo. Quitamos el registro el mismo día, sin
preguntas.

Contacto del equipo: (see src/contact.ts)  (correo)

☐ Sí, pueden incluirnos.   Nombre del negocio: _______________________________

Idiomas en el mostrador: ☐ Español ☐ Inglés    Puesto / turno: _______________

Firma (dueño o gerente): ________________________   Fecha: _______________

---

### For the team: after a yes

1. Add one row to `data/venues.csv`. `status` is `listed_by_business`.
   `roles` and `shifts` are free text, written the way the sheet says it
   ("cashier, afternoons"); never a name. The tests fail on anything in those
   columns that looks like a person's name. `format` is `in_person`, `online`
   or `both` (a business is `in_person`; a Zoom conversation group is `online`).
   `notes`, `source` and `verified_on` are for us and never reach the app.
2. Look the address up once, on the Census Bureau geocoder website
   (geocoding.geo.census.gov) or any map, and paste `lat` and `lng` into the
   row. There is no geocoder in the script. Then run `npm run venues`; a row
   without coordinates is skipped and named loudly in the output, so nothing
   silently vanishes from the map.
3. Keep the signed sheet. If a judge or the business asks, that is the proof of
   consent.
4. Public programs (libraries, community colleges, the driver-services office)
   do not need a signature; they are `listed_public`.
5. A business that asks to be removed: delete the row, run `npm run venues`,
   deploy. Same day.
