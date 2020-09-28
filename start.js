(async build => {
    if (!build.EntryPoint) return console.error('Unable to start: Entry point not found');
    
    if (!('main' in build.EntryPoint)) return console.error('Unable to start: "main" method not found in the entry point class');
    
    if (typeof build.EntryPoint.main != 'function') return console.error('Unable to start: "main" is not a method in the entry point class');
    
    const args = process.argv.slice(2);
    const result = await build.EntryPoint.main(args);
    
    process.exitCode = ({number: result, bigint: Number(result), boolean: result ^ 1})[typeof result];
})(require('./build'));
