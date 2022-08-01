import {promises as fs} from 'fs';

export var lineSeparator = '\n'

export var EOT = Symbol('EOT')

export type Txt2SqlOptions = {
    fieldSeparator: '|' | ',' | ';' | '\t' | '...'
    lineSeparator: '\n' | '\r\n' | '\r' | '...'
    inferTypes: boolean
}

export const txt2sqlOption = {
    bp_tab: { fieldSeparator: '|', lineSeparator } as Txt2SqlOptions
}

export type ChunkReader = (chunk:string | typeof EOT) => void
export type ChunkReaders = {
    inserts: ChunkReader,
    createTable: ChunkReader
}

export class Txt2Sql{
    private firstLine = true
    private ended = false
    private columns = [] as string[]
    constructor(public readers: ChunkReaders, public options:Txt2SqlOptions = txt2sqlOption.bp_tab){}
    processLine(line:string | typeof EOT){
        if(this.ended) return;
        if(line === EOT){
            this.readers.inserts?.(EOT);
            this.ended = true;
        }else if(typeof line === "symbol"){
            return;
        }else if(this.firstLine){
            this.columns = line.split(this.options.fieldSeparator).map(name=>name.replace(/\W/g,'_'));
            this.readers.createTable(
                "create table table1 (" + 
                this.columns.map(x=>"\n " + x + " text").join(",") + 
                "\n);"
            );
            this.readers.createTable?.(EOT);
            this.firstLine = false;
        }else{
            this.readers.inserts?.(
                "insert into table1 (" + 
                this.columns.join(", ") + 
                ") values ('" + 
                line.split(this.options.fieldSeparator).map(value=>value.replace(/'/g, "''")).join("', '") + 
                "');"
            )
        }
    }
    async processSmallFile(fileName:string){
        var fh = await fs.open(fileName)
        var content = await fh.readFile('utf-8');
        for(var line of content.split(/\r?\n/)){
            this.processLine(line);
        }
        this.processLine(EOT);
    }
    static createChunkWriter(fileName:string){
        var chunks = [] as string[];
        return function chunkReader(chunk:string|typeof EOT){
            if(chunk === EOT){
                fs.writeFile(fileName, chunks.join('\n'));
            }else if(typeof chunk === "symbol"){
                console.log("unknown symbol", chunk)
                throw new Error("unkown symbol");
            }else{
                chunks.push(chunk);
            }
        }
    }
}

if(process.argv.length>2){
    var reExt = /\.\w+$/;
    var fileName = process.argv[2];
    if(!fileName.match(reExt)){
        throw new Error("filename must has an extension")
    }
    var inserts = Txt2Sql.createChunkWriter(fileName.replace(reExt, '-inserts-local.sql'))
    var createTable = Txt2Sql.createChunkWriter(fileName.replace(reExt, '-create-table-local.sql'))
    var txt2sql = new Txt2Sql({inserts, createTable});
    txt2sql.processSmallFile(fileName);
}
