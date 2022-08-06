import {promises as fs} from 'fs';
import * as Path from 'path';

export const lineSeparator = '\n'

export type Txt2SqlOptions = {
    fieldSeparator: '|' | ',' | ';' | '\t' | '...'
    lineSeparator: '\n' | '\r\n' | '\r' | '...'
    inferTypes: boolean
}

export const txt2sqlOption = {
    bp_tab: { fieldSeparator: '|', lineSeparator } as Txt2SqlOptions
}

export interface OutWritter {
    write(paragraph:string):Promise<void>
    close():Promise<void> // no more writes/closes allowed
}

export interface OutWritterFactory {
    open(fileName:string):Promise<OutWritter>
    end():Promise<void> // no more writes/closes allowed in any opened file
}

export class FileWritter implements OutWritter{
    constructor(public file:fs.FileHandle){}
    async write(paragraph:string){
        await this.file.write(paragraph);
    }
    async close(){
        return this.file.close()
    }
}

export class FileWritterFactory implements OutWritterFactory{
    public extension = '.sql'
    async open(fileName:string){
        if(!Path.extname(fileName)){
            fileName += this.extension;
        }
        return new FileWritter(await fs.open(fileName,undefined,'w'));
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    async end(){}
}

const fileNames = ['inserts', 'create_table'] as
                  ('inserts'| 'create_table')[];

enum States { New, Started, Processing, Ended }

export class Txt2Sql{
    private state: States = States.New
    private columns = [] as string[]
    private writter = {} as Record<typeof fileNames[0], OutWritter>
    constructor(private fileWritterFactory: OutWritterFactory, public options:Txt2SqlOptions = txt2sqlOption.bp_tab){
    }
    expectState(states:States[]){
        if(states.filter(s => s == this.state).length == 0){
            throw new Error("expected states "+states.map(s => States[s]) + " but was " + States[this.state]);
        }
    }
    async processStart(){
        this.expectState([States.New]);
        for(const fileName of fileNames){
            // eslint-disable-next-line no-await-in-loop
            this.writter[fileName] = await this.fileWritterFactory.open(fileName);
        }
        this.state = States.Started;
    }
    async processLine(line:string){
        this.expectState([States.Started, States.Processing]);
        if(this.state == States.Started){
            this.columns = line.split(this.options.fieldSeparator).map(name=>name.replace(/\W/g,'_'));
            await this.writter.create_table?.write(
                "create table table1 (" + 
                this.columns.map(x=>"\n " + x + " text").join(",") + 
                "\n);"
            );
            await this.writter.create_table?.close();
            this.state = States.Processing;
        }else{
            await this.writter.inserts?.write(
                "insert into table1 (" + 
                this.columns.join(", ") + 
                ") values ('" + 
                line.split(this.options.fieldSeparator).map(value=>value.replace(/'/g, "''")).join("', '") + 
                "');"
            )
        }
    }
    async processEnd(){
        this.expectState([States.Started, States.Processing]);
        await this.writter.inserts?.close();
        this.state = States.Ended;
    }
    async processSmallFile(fileName:string){
        const fh = await fs.open(fileName)
        const content = await fh.readFile('utf-8');
        await this.processStart();
        for(const line of content.split(/\r?\n/)){
            // eslint-disable-next-line no-await-in-loop
            await this.processLine(line);
        }
        await this.processEnd();
    }
}

if(process.argv.length>2){
    const reExt = /\.\w+$/;
    const fileName = process.argv[2];
    if(!fileName.match(reExt)){
        throw new Error("filename must has an extension")
    }
    const txt2sql = new Txt2Sql(new FileWritterFactory());
    txt2sql.processSmallFile(fileName);
}
