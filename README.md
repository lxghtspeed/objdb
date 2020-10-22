
<link rel="stylesheet" type="text/css" media="all" href="https://nodejs.org/dist/latest-v12.x/docs/api/assets/style.css"/>

# Overview
Objdb is a module containing features allowing you to manage an object that is being saved automatically [Class: `Database`](#database)
<a class="type">tadasfasfagasdasfest</a>
You can store, edit, remove values inside of it, it will all be saved and can be accessed even after a system reboot.
Basically a database, powerful but not enough, still working on it to make it as good as expected

Requires **Node.js 11** or higher version

## Project's advancement
- [x] Strongly typed (TypeScript)
- [x] Stores in a local file
- [x] Easy prototype restoring
- [x] Provides own [Serialization API](#serialization-api)
- [x] Support of circular structured objects and objects that are referenced several times
- [x] Backup system
- [ ] Client and Server: remotely operate over the data

## Supported data types
It supports the most of :
- the instances of the built-in classes **`Object` `Array` `Map` `Set` `Date` `Buffer` `RegExp` `String` `Boolean` `Number`**
- the primitive types `string` `number` `boolean` `object` `bigint` `undefined` `null`

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
    - [`Database.delete(database)`](#db-delete-1)
    - [`Database.delete(name[, path])`](#db-delete-2)
    - `Database.defaultPath` [\<string>]()
    - [`new Database([options])`](#db-new)
    - [`database.save()`](#db-proto-save)
    - [`database.forceSave()`](#db-proto-forcesave)
    - [`database.close()`](#db-proto-close)
    - `database.backups` [\<BackupManager>](#class-bm)
    - [Event: `save`](#db-event-save)
    - [Event: `backup`](#db-event-backup)
  - [Class: `BackupManager`](#class-bm) private
    - [`backups.create()`](#bm-proto-create)
    - [`backups.max`](#bm-proto-max)
    - [`backups.interval`](#bm-proto-interval)
    - [`backups.cache`](#bm-proto-cache)
    - [`backups.oldest`](#bm-proto-oldest)
    - [`backups.latest`](#bm-proto-latest)
    - [`backups.count`](#bm-proto-count)
  - [Class: `Backup`](#class-backup) private
    - [`backup.delete()`](#backup-proto-delete)
    - [`backup.load()`](#backup-proto-load)
    - [`backup.save()`](#backup-proto-save)
    - [`backup.name`](#backup-proto-name)
    - [`backup.fullPath`](#backup-proto-fullpath)
    - [`backup.createdAt`](#backup-proto-createdat)
    
  - [Class: `Serializer`](#class-sr)
    
    - [`Serializer.clone([value])`](#sr-clone)
    - `Serializer.version`
    - [`Serializer.defaultConstructors`](#sr-defaultctr)
    - [`new Serializer([constructors])`](#sr-new)
    - [`serializer.constructors`](#sr-proto-ctr)
    - [`serializer.serialize([value])`](#sr-proto-serialize)
    - [`serializer.deserialize(data)`](#sr-proto-deserialize)

# Objdb
```js
const { /* Classes... */ } = require('objdb');
```
<h2 id="class-db">Class: <code>Database</code></h2>

```js
const db = new Database(); // Stored in ./data/default.json
// Note: It does not save unless you modify

db.test = 'successful';
db.some = new Map();
db.some.set('more', 'datas');

// Optional
test.save();
```
<h3 id="db-delete-1"><code>Database.delete(database)</code></h3>

<h3 id="db-delete-2"><code>Database.delete(name[, path])</code></h3>

<h3 id ="db-defaultpath"><code>Database.defaultPath</code></h3>

<h3 id ="db-new"><code>new Database([options])</code></h3>

<h3 id ="db-proto-save"><code>database.save()</code></h3>

<h3 id ="db-proto-forcesave"><code>database.forceSave()</code></h3>

<h3 id ="db-proto-close"><code>database.close()</code></h3>

<h3 id ="db-proto-backups"><code>database.backups</code></h3>

<h3 id ="db-event-save">Event: <code>save</code></h3>

<h3 id ="db-event-backup">Event: <code>backup</code></h3>

<h2 id="class-bm">Class: <code>BackupManager</code></h2>

<h3 id="bm-proto-create"><code>backups.create()</code></h3>

<h3 id="bm-proto-max"><code>backups.max</code></h3>

<h3 id="bm-proto-interval"><code>backups.interval</code></h3>

<h3 id="bm-proto-cache"><code>backups.cache</code></h3>

<h3 id="bm-proto-oldest"><code>backups.oldest</code></h3>

<h3 id="bm-proto-latest"><code>backups.latest</code></h3>

<h3 id="bm-proto-count"><code>backups.count</code></h3>

<h2 id="class-backup">Class: <code>Backup</code></h2>

<h3 id="backup-proto-delete"><code>backup.delete()</code></h3>

<h3 id="backup-proto-load"><code>backup.load()</code></h3>

<h3 id="backup-proto-save"><code>backup.save()</code></h3>

<h3 id="backup-proto-name"><code>backup.name</code></h3>

<h3 id="backup-proto-fullpath"><code>backup.fullPath</code></h3>

<h3 id="backup-proto-createdat"><code>backup.createdAt</code></h3>

<h2 id="class-sr">Class: <code>Serializer</code></h2>

# Examples

## Prototype restoring
```js
const { Database } = require('objdb');

class Player { /* Imagination */ }
class Sword { /* Imagination */ }

/* Initialization of the database */
const db = new Database({
	defaults: {
		players: new Map();
	},
	/* Add the constructors here */
	constructors: [ Player, Sword ]
});

// Supposed to be of type Player
const p1 = db.players.get('xXProKillerXx');
const p2 = db.players.get('Imagination');

// Supposed to be of type Sword
const sword = p1.inventory[0];

p1.attack(p2, sword);
```

## Serialization API
```js
const { Serializer } = require('objdb');
const s = new Serializer([ /* Constructors here */ ]);

// An object
const o = { testing: Infinity, serialization: Buffer.from('asd'), [0]: /ab+c/i };

// Serialize to json
const data = s.serialize(o);

// Deserialize from json
const o2 = s.deserialize(data);

console.log(o);
console.log(data);
console.log(o2);

/* Output:
 *   { '0': /ab+c/i, testing: Infinity, serialization: <Buffer 61 73 64> }
 *   {"version":"1.0","value":0,"references":[["Object",[[0,"0",1],[0,"testing",[3,"Infinity"]],[0,"serialization",2]]],["RegExp",[],"ab+c","i"],["Buffer",[],"YXNk"]]}
 *   { '0': /ab+c/i, testing: Infinity, serialization: <Buffer 61 73 64> }
 */
```
