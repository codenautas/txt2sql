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
}
