import {promises as fs} from 'fs';
import * as Path from 'path';

export type Txt2SqlOptions = {
    fieldSeparator: '|' | ',' | ';' | '\t' | '...'
}

export const txt2sqlOption = {
    bp_tab: { fieldSeparator: '|'  } as Txt2SqlOptions
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

enum Part { Body, Head }

type Txt2SqlOpenedMembers = {
    columns: string[]
    inserts: OutWritter
    create_table: OutWritter
    part: Part
}

enum Status { New, Started, Done }

type Txt2SqlStatus = { is: Status.New | Status.Done } | { is: Status.Started } & Txt2SqlOpenedMembers

export class Txt2Sql{
    private status: Txt2SqlStatus = { is: Status.New }
    constructor(private owf: OutWritterFactory, public options:Txt2SqlOptions = txt2sqlOption.bp_tab){
    }
    async processStart(){
        switch(this.status.is){
            case Status.New:
                this.status = {
                    is: Status.Started,
                    columns: [],
                    create_table: await this.owf.open('create_table'),
                    inserts: await this.owf.open('inserts'),
                    part: Part.Head
                }
            break;
            default: throw Error("wrong status at process_end: "+this.status);
        }
    }
    async processLine(line:string){
        switch(this.status.is){
            case Status.Started:
                if(this.status.part == Part.Head){
                    this.status.columns = line.split(this.options.fieldSeparator).map(name=>name.replace(/\W/g,'_'));
                    await this.status.create_table.write(
                        "create table table1 (" + 
                        this.status.columns.map(x=>"\n " + x + " text").join(",") + 
                        "\n);"
                    );
                    await this.status.create_table.close();
                    this.status.part = Part.Body;
                }else{
                    await this.status.inserts?.write(
                        "insert into table1 (" + 
                        this.status.columns.join(", ") + 
                        ") values ('" + 
                        line.split(this.options.fieldSeparator).map(value=>value.replace(/'/g, "''")).join("', '") + 
                        "');"
                    )
                }
            break;
            default: throw Error("wrong status at process_end: "+this.status);
        }
    }
    async processEnd(){
        switch(this.status.is){
            case Status.Started:
                await this.status.inserts.close();
                this.status = {is: Status.Done};
            break;
            default: throw Error("wrong status at process_end: "+this.status);
        }
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
