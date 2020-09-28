# Overview
Objdb is a basic object that is being saved automatically.

You can store, edit, remove values inside of it, it will all be saved and can be accessed even after a system reboot.
Basically a database, powerful but not enough, still working on it to make it as good as expected

Requires **Node 10** and later

**New**: Partially supports [user defined prototypes](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Objects/Object_prototypes)
- check out how to use the *prototype restoring system* in [this section](#prototype-restoring-system)

## Project's advancement
- [x] Strongly typed (TypeScript)
- [x] Stores in a local file
- [x] Easy prototype restoring
- [x] Provides own serialization API
- [ ] Support of circular objects and multiple referenced objects
- [ ] Client and Server: remotely operate over the datas

## Supported data types
It supports the most of :
- the instances of the built-in classes **`Object` `Array` `Map` `Set` `Date` `Buffer` `String` `Boolean` `Number` `RegExp`**
- the primitive types `string` `number` `boolean` `object` `bigint` `undefined` `null`

## Limits
You can not use these types inside a database
- [Function / Class constructor / Generator function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions)
- [Symbol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol)
- [WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) and [WeakSet](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet)
- [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
- and more

# Examples
## Understanding
```js
const { LocalFile } = require('objdb');

const drift = new LocalFile({
	name: 'drift',
	defaults: {
		records: []
	}
});

/* Adds some random records */
for (let i = 0; i < 10; i++) {

    drift.records.push({
        user: `User${Math.floor(Math.random() * 2000)}`,
        score: Math.floor(Math.random() * 50000)
    });

}

/* Sorts the records by score */
drift.records.sort((a, b) => b.score - a.score);

/* Shows a top-10 of the records */
console.log(drift.records.slice(0, 10));
```

## Prototype restoring system
```js
const { LocalFile } = require('objdb');

class Item {

	constructor(name = 'Unknown', durability = Infinity, price = 0) {
		this.name = name;
		this.durability = durability;
		this.price = price;
	}

	use() {
		if (this.durability <= 0) return console.log(`This ${this.name} is out of durability`);
		
		this.durability--;

		console.log(`You used ${this.name}`);
	}

}

/* Initialize the database */
const db = new LocalFile({
	name: 'data',
	defaults: {
		inventory: []
	},
	constructors: [ Item ] /* We `in`sert the constructor Item */
});

/* A magic book that we can use only twice */
const item = new Item('Magic Book', 2);

/* Save the magic book */
db.inventory.push(item);

/* Try to use all the magic books */
db.inventory.forEach(i => i.use());

/* Output at the 5th launch:
 *   This Magic Book is out of durability
 *   This Magic Book is out of durability
 *   This Magic Book is out of durability
 *   You used Magic Book
 *   You used Magic Book
 */
```

## Serialization API
```js
const { Serializer } = require('objdb');
const s = new Serializer();

// An object
const o = {testing: Infinity, serialization: Buffer.from('asd'), [0]: /ab+c/i};

// Serialize to json
const data = s.serialize(o);

// Deserialize from json
const o2 = s.deserialize(data);

console.log(o);
console.log(data);
console.log(o2);

/* Output:
 *   { '0': /ab+c/i, testing: Infinity, serialization: <Buffer 61 73 64> }
 *   ["object","Object",[["key","0",["object","RegExp",[],"ab+c","i"]],["key","testing",["number","Infinity"]],["key","serialization",["object","Buffer",[],"YXNk"]]]]
 *   { '0': /ab+c/i, testing: Infinity, serialization: <Buffer 61 73 64> }
 */
```
