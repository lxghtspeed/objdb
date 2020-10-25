# Overview

Objdb is a module containing features allowing you to manage an object that is being saved automatically [Class: `Database`](#class-db) it also provides a Serialization API [Class: `Serializer`](#class-sr)

powerful but not enough, still working on it to make it as good as expected.

Requires **Node.js 10** or higher version

## Project's advancement

- [x] Supports [JavaScript's OOP](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/Object-oriented_JS)
- [x] Provides own Serialization API
- [x] Backup system
- [ ] Client and Server: remotely operate over the data

## Supported data types

It supports the most of :
- the instances of the built-in classes **`Object` `Array` `Map` `Set` `Date` `Buffer` `RegExp` `String` `Boolean` `Number`**
- the primitive types `string` `number` `boolean` `bigint` `undefined` `null`

## Limits

You can not use these types inside a database
- [Function / Class constructor / Generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions)
- [Symbol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
- [WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) and [WeakSet](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet)
- [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
- and more

# Quick Documentation

- [**Objdb**](#objdb)
  - [Class: `Database`](#class-db)
    - [Static property: `Database.defaultPath`](#db-defaultpath)
    - [`new Database([options])`](#db-new)
    - [`db.save()`](#db-proto-save)
    - [`db.forceSave()`](#db-proto-forcesave)
    - [`db.close()`](#db-proto-close)
    - [`db.delete()`](#db-proto-delete)
    - `db.backups` [`<BackupManager>`]
    - [Event: `save`](#db-event-save)
    - [Event: `backup`](#db-event-backup)
  - [Class: `BackupManager`](#class-bm) *private*
    - [`backups.create()`](#bm-proto-create)
    - `backups.max` [`<number>`]
    - `backups.interval` [`<number>`]
    - [`backups.cache`](#bm-proto-cache)
    - [`backups.oldest`](#bm-proto-oldest)
    - [`backups.latest`](#bm-proto-latest)
  - [Class: `Backup`](#class-backup) *private*
    - [`backup.delete()`](#backup-proto-delete)
    - [`backup.load()`](#backup-proto-load)
    - [`backup.save()`](#backup-proto-save)
    - `backup.name` [`<string>`]
    - `backup.fullPath` [`<string>`]
    - `backup.createdAt` [`<Date>`]
  - [Class: `Serializer`](#class-sr)
    - [Static method: `Serializer.clone([value])`](#sr-clone)
    - Static property: `Serializer.version` [`<string>`]
    - [Static property: `Serializer.defaultConstructors`](#sr-defaultctr)
    - [`new Serializer([constructors])`](#sr-new)
    - [`ser.constructors`](#sr-proto-ctr)
    - [`ser.serialize([value])`](#sr-proto-serialize)
    - [`ser.deserialize(data)`](#sr-proto-deserialize)

# Objdb

The module's structure is like a namespace containing classes.

Common way to require/import objdb:

```js
const { /* Classes... */ } = require('objdb');
```

```ts
import { /* Classes... */ } from 'objdb';
```

<h2 id="class-db">Class: <code>Database</code></h2>

Once the instance is created, you can store, edit, remove values inside of it, it will all be saved automatically.

Supports JavaScript's OOP via [prototype restoring](#db-new).

This class is avaiable in the module's namespace:

```js
const { Database } = require('objdb');
```

#### Example of usage

```js
// Creates an instance of Database with default settings
const db = new Database();
// Will be stored in ./data/default.json
// Note: It does not save unless you modify

db.test = 'successful';
db.some = new Map();
db.some.set('more', 'datas');

// Optional
test.save();
```

<h3 id ="db-defaultpath">Static property: <code>Database.defaultPath</code></h3>

- Type: [`<string>`]
- Default: `'./data'`

Allows you to change the default path to folder for every Database instance to create, (will become their default option).

<h3 id ="db-new"><code>new Database([options])</code></h3>

- `options` [`<Object>`]
  - `name` [`<string>`] The name of the database **Default:** `'default'`.
  - `path` [`<string>`] The path to the folder where the file will be stored **Default:** [`Database.defaultPath`](#db-defaultpath).
  - `defaults` [`<Object>`] The default values, **Default:** `{}`.
  - `constructors` [`<Array>`] The constructors to use for the prototype restorer **Default:** `[]`.
  - `interval` [`<number>`] The interval which the automatic saving system will check for changes then save, **Minimum:** `1000` **Never:** `Infinity` **Default:** `8000`.
  - `backupInterval` [`<number>`] The interval in hours which the backup system will make a new backup **Minimum:** `1` **Never:** `Infinity` **Default:** `8`.
  - `maxBackups` [`<number>`] Limits the count of backups **Default:** `6`.
  - Returns: a new instance if the file is not already opened, once opened every calls to `new` will return the same instance, you can use [`db.close()`](#db-proto-close) to close a [`<Database>`].

Creates an instance with specified settings, (default settings if omitted).

The full path of the data file is formated as *`path`/`name`.json*

#### Example

```js
class Player { /* Imagination */ }
class Sword { /* Imagination */ }

const db = new Database({
  name: 'fantastic',
  defaults: {
    players: new Map();
  },
  constructors: [ Player, Sword ]
});
```

<h3 id ="db-proto-save"><code>db.save()</code></h3>

Attempts to save, cancels the operation if no changes were found.

If the last save were in the last `1000ms` it postpones the operation until that `1000ms` expires.

It is called on interval by the automatic saving system.

<h3 id ="db-proto-forcesave"><code>db.forceSave()</code></h3>

Synchronous version of [`db.save()`](#db-proto-save), it overrides the `1000ms` rule.

It is called once the process exits or whenever the [`<Database>`] is being closed with [`db.close()`](#db-proto-close).

<h3 id ="db-proto-close"><code>db.close()</code></h3>

Attempts to synchronously save and closes this instance then changes it's prototype to [`<Object>`].

This instance will not be an instance of [`<Database>`] anymore, and thus, you will neither be able to use it's methods nor properties.

<h3 id="db-proto-delete"><code>db.delete()</code></h3>

- Returns: A [`<Promise>`] resolving [`<undefined>`] once the operation is done.

Closes this instance (with [`db.close()`](#db-proto-close)), then deletes the corresponding file and it's backups.

<h3 id ="db-event-save">Event: <code>save</code></h3>

This event is triggered whenever a save operation is completed.

<h3 id ="db-event-backup">Event: <code>backup</code></h3>

- `backup` [`<Backup>`] the backup that has been created.

This event is triggered whenever a backup has been created.

<h2 id="class-bm">Class: <code>BackupManager</code></h2>

This class is used to list backups upon the database, it is not exported.

<h3 id="bm-proto-create"><code>backups.create()</code></h3>

- Returns: [`<Backup>`]

Creates a new backup and deletes the oldest one if the backups count limit is reached.

<h3 id="bm-proto-cache"><code>backups.cache</code></h3>

- Type: An [`<Array>`] of [`<Backup>`].

<h3 id="bm-proto-oldest"><code>backups.oldest</code></h3>

- Type: [`<Backup>`] or [`<undefined>`].

Returns the oldest cached backup.

<h3 id="bm-proto-latest"><code>backups.latest</code></h3>

- Type: [`<Backup>`] or [`<undefined>`].

Returns the latest cached backup.

<h2 id="class-backup">Class: <code>Backup</code></h2>

This class is used to represent a single backup, few methods and properties are avaiable, it is not exported.

<h3 id="backup-proto-delete"><code>backup.delete()</code></h3>

- Returns: A [`<Promise>`] resolving [`<undefined>`] once the deletion is done.

Deletes the corresponding backup file to this instance.

<h3 id="backup-proto-load"><code>backup.load()</code></h3>

Loads values from the backup into the corresponding [`<Database>`] to this instance.

<h3 id="backup-proto-save"><code>backup.save()</code></h3>

Saves the values from the corresponding [`<Database>`] into the corresponding backup file.

<h2 id="class-sr">Class: <code>Serializer</code></h2>

Allows you to convert mostly all of the JavaScript's values into [`<string>`].

OOP is conserved as well as circular and multiple referenced objects.

This class is avaiable in the module's namespace:

```js
const { Serializer } = require('objdb');
```

<h3 id="sr-clone">Static method: <code>Serializer.clone([value])</code></h3>

 - `value` [`<any>`]
 - Returns: a clone of `value`.

Clones `value`.

<h3 id="sr-defaultctr">Static property: <code>Serializer.defaultConstructors</code></h3>

 - Type: An [`<Array>`] of [`<Constructor>`].

Contains `Object` `Array` `Map` `Set` `Buffer` `Date` `RegExp` `String` `Boolean` `Number` by default.

<h3 id="sr-new"><code>new Serializer([constructors])</code></h3>

- `constructors` [`<Array>`] An array of [`<Constructor>`] that makes possible OOP operations on parsed data, extends [`Serializer.defaultConstructors`](#sr-defaultctr) **Default:**`[]`.

Creates an instance with specified constructors.

<h3 id="sr-proto-ctr"><code>ser.constructors</code></h3>

 - Type:  An [`<Array>`] of [`<Constructor>`]

The constructors that is used to restore prototypes of data when parsing.

<h3 id="sr-proto-serialize"><code>ser.serialize([value])</code></h3>

 - `value` [`<any>`] The value to serialize.
 - Returns: [`<string>`]

Serializes `value` to string with a weird JSON structure containing few properties:

 - `version` [`<string>`] Representing the version of the serializer
 - `value` [`<number>`] Indexing the references, may be the reference itself when `value` is primitive
 - `references` An [`<Array>`] containing references as complex structures

```js
const sr = new Serializer();

// An object to serialize
const o = { testing: Infinity, serialization: Buffer.from('asd'), [0]: /ab+c/i };

sr.serialize(o);
// '{"version":"1.0","value":0,"references":[["Object",[[0,"0",1],[0,"testing",[3,"Infinity"]],[0,"serialization",2]]],["RegExp",[],"ab+c","i"],["Buffer",[],"YXNk"]]}'
```

<h3 id="sr-proto-deserialize"><code>ser.deserialize(data)</code></h3>

 - `data` [`<string>`] The serialized value to parse
 - Returns: [`<any>`]

Parses `data` to return a clone of the value that has been serialized using [`ser.serialize([value])`](#sr-proto-serialize)


[`<string>`]:  https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/String
[`<number>`]: https://developer.mozilla.org/en-US/docs/Glossary/Number
[`<boolean>`]: https://developer.mozilla.org/en-US/docs/Glossary/Boolean
[`<undefined>`]: https://developer.mozilla.org/en-US/docs/Glossary/Undefined
[`<any>`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures
[`<Promise>`]: https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Objets_globaux/Promise
[`<Object>`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object
[`<Array>`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
[`<Date>`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date

[`<Database>`]: #class-db
[`<BackupManager>`]: #class-bm
[`<Backup>`]: #class-backup
[`<Serializer>`]: #class-sr

[`<Constructor>`]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes