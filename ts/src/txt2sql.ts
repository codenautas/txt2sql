import {promises as fs} from 'fs';
import * as Path from 'path';

export type Txt2SqlOptions = {
    field_separator: '' | '|' | ',' | ';' | '\t' | '...'
    table_name?: string
    quote_identifiers: string
    case: 'lower' | 'upper' | 'mixed'
    insert_columns: boolean
    multi_insert: boolean
    infer_types: boolean
    output_types: boolean
  }

export const txt2sqlOption = {
    for_test: { 
        field_separator: '',
        insert_columns: false,
        multi_insert: true,
        quote_identifiers: '',
        case: 'mixed',
        infer_types: false,
        output_types: false
    } as Txt2SqlOptions
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

abstract class TypeBase<T> {
    abstract parseValue(rawValue:string):T|null
    abstract quoteValue(value:T):string
    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
    registerOptions(_value:T, _rawValue:string){}
}

class TypeInferer<T, T2 extends TypeBase<T>>{
    maxValue:T|null = null
    minValue:T|null = null
    otherValues = false
    hasNull = false
    hasInvalid:boolean = false
    constructor(public typer:T2){}
    inferValue(rawValue:string|null){
        if(this.hasInvalid) return;
        if(rawValue == null){
            this.hasNull = true;
        } else {
            const value = this.typer.parseValue(rawValue);
            if(value == null){ 
                this.hasInvalid = true;
                this.hasInvalid = rawValue as unknown as true;
                return;
            }
            this.typer.registerOptions(value, rawValue);
            if(this.maxValue == undefined || this.minValue == undefined ){
                this.maxValue = value
                this.minValue = value
            }else if(value >= this.maxValue){
                this.maxValue = value
            } else if(value <= this.minValue){
                this.minValue = value
            } else {
                this.otherValues = true;
            }
        }
    }
}

class TypeProcessor<T, T2 extends TypeBase<T>>{
    constructor(protected typer:T2, protected columnName:string){}
    processValue(rawValue:string|null, line:number):string{
        if(rawValue == null){
            return 'null';
        }
        const value = this.typer.parseValue(rawValue);
        if(value == undefined){ 
            throw new Error(`invalid value "${rawValue}" in column "${this.columnName}" line ${line}`)
        }
        return this.typer.quoteValue(value);
    }
}

export type Constructor<T> = new(...args: unknown[]) => T;
export type AbstractConstructor<T> = abstract new(...args: unknown[]) => T;

type TypeConstructor = typeof TypeBase
// type TypeConstructor = Constructor<TypeBase<unknown>>

class StringType extends TypeBase<string>{
    maxLength = 0
    quoteValue(value: string): string {
        return "'" + value.replace(/'/g, "''") + "'";
    }
    parseValue(rawValue: string): string {
        return rawValue;
    }
    override registerOptions(value: string): void {
        if(value.length > this.maxLength) this.maxLength = value.length;
    }
}

class NumberType extends TypeBase<number>{
    protected hasDecimal = false
    protected rawDecimal = '.'
    quoteValue(value: number): string {
        return value.toString();
    }
    parseValue(rawValue: string): number | null {
        const value = Number(rawValue);
        if(isNaN(value)){
            return null
        }
        return value
    }
    override registerOptions(_value: number, rawValue:string): void {
        if(rawValue.includes(this.rawDecimal)){
            this.hasDecimal = true;
        }
    }
}

const numberSignInverter = {'.':',', ',':'.'};

class SpanishNumberType extends NumberType{
    constructor(){
        super()
        this.rawDecimal = ','
    }
    override parseValue(rawValue: string): number | null {
        return super.parseValue(rawValue.replace(/[.,]/g, (sign:string) => numberSignInverter[sign as '.'|',']))
    }
}

type ColumnInfoTypeRaw = {type_name: 'text', max_length: null}

type ColumnInfoTypes = ColumnInfoTypeRaw

type ColumnInfo = ColumnInfoTypes & {name:string}

var rawColumninfo: ColumnInfoTypeRaw = {type_name:'text', max_length: null}

enum Part { Body, Head }

type Txt2SqlOpenedMembers = {
    columnProcessor: TypeProcessor<unknown, TypeBase<unknown>>[]
    columnInfo: ColumnInfo[]
    create_table_raw: OutWritter
    inserts: OutWritter
    create_table?: OutWritter
    part: Part
    rowNumber: number
}

enum Status { New, Started, Done }

type Txt2SqlStatus = { is: Status.New | Status.Done } | { is: Status.Started } & Txt2SqlOpenedMembers

function createNew<T extends TypeBase<unknown>>(c:AbstractConstructor<T>):T{
    //@ts-expect-error For create without estends
    return new c();
}

export class Txt2Sql{
    private status: Txt2SqlStatus = { is: Status.New }
    private table_name;
    protected columnInfering: TypeInferer<unknown, TypeBase<unknown>>[][] = []
    constructor(private owf: OutWritterFactory, public options:Txt2SqlOptions = txt2sqlOption.for_test){
        this.table_name = this.getIdentifier(this.options.table_name || 'table1');
    }
    caseIdentifier(identifier:string){
        return this.options.case == 'mixed' ? identifier : 
            (identifier[this.options.case == 'upper' ? 'toLocaleUpperCase' : 'toLocaleLowerCase']())
    }
    quoteIdentifier(identifier:string):string{
        const q = this.options.quote_identifiers;
        const replaced = q != '' ? q + q : '_';
        return q + identifier.replace(q != '' ? new RegExp(q, 'g') : /\W/g, replaced) + q;
    }
    getIdentifier(identifier:string){
        return this.quoteIdentifier(this.caseIdentifier(identifier))
    }
    async processStart(){
        switch(this.status.is){
            case Status.New:
                this.status = {
                    is: Status.Started,
                    columnInfo: [],
                    columnProcessor: [],
                    create_table_raw: await this.owf.open('create_table_raw'),
                    inserts: await this.owf.open('inserts'),
                    part: Part.Head,
                    rowNumber: 0
                }
                if(this.options.infer_types){
                    this.columnInfering = []
                }
            break;
            default: throw Error("wrong status at process_end: "+this.status);
        }
    }
    inferType(rawValue:string, columnNumber:number){
        if(this.status.is != Status.Started) throw new Error('cannot inferType if not Started')
        const columnInfering = this.columnInfering[columnNumber];
        columnInfering.forEach(inferer => inferer.inferValue(rawValue));
    }
    typeConstructors():TypeConstructor[]{
        return [NumberType, SpanishNumberType, StringType];
    }
    processColumns(rawNames:string[]){
        if(this.status.is != Status.Started) throw new Error('cannot processColumns if not Started')
        for(let i = 0; i < rawNames.length; i++){
            const rawName = rawNames[i]
            const name =  this.getIdentifier(rawName);
            this.status.columnInfo.push({name, ...rawColumninfo});
            this.status.columnProcessor.push(new TypeProcessor(new StringType(), name));
            this.columnInfering.push(this.typeConstructors().map(c =>new TypeInferer(createNew(c))));
        }
    }
    createTableSql(){
        var esto = this;
        switch(esto.status.is){
            case Status.Started:
                return "create table " + this.table_name + " (" + 
                    esto.status.columnInfo.map(info => "\n " + info.name + " " + info.type_name).join(",") + 
                "\n);\n";
            default: throw Error("wrong status at createTableSql: "+this.status);
        }
    }
    async processLine(line:string){
        switch(this.status.is){
            case Status.Started:
                if(this.status.part == Part.Head){
                    this.processColumns(line.split(this.options.field_separator));
                    await this.status.create_table_raw.write(this.createTableSql());
                    await this.status.create_table_raw.close();
                    this.status.part = Part.Body;
                }else{
                    const firstRow = !this.status.rowNumber;
                    const rawValues = line.split(this.options.field_separator);
                    if(this.options.infer_types){
                        rawValues.forEach((rawValue, columnNumber) => this.inferType(rawValue, columnNumber))
                    }
                    const dataLine = "('" + 
                    rawValues.map(value=>value.replace(/'/g, "''")).join("', '") + 
                    "')"
                    await this.status.inserts?.write(
                        (!this.options.multi_insert || firstRow ?
                            "insert into " + this.table_name + (
                                this.options.insert_columns ? " (" + 
                                this.status.columnInfo.map(i=>i.name).join(", ") + 
                                ") " 
                                : " "
                            ) + "values" + (this.options.multi_insert ? "\n " : " " ) : ",\n " 
                        ) + dataLine + (this.options.multi_insert ? "" : ";\n")
                    )
                    this.status.rowNumber++
                }
            break;
            default: throw Error("wrong status at process_end: "+this.status);
        }
    }
    async saveCreateTable(){
        switch(this.status.is){
            case Status.Started:
                var file = await this.owf.open('create_table')
                this.status.create_table = file
                for(var i = 0; i < this.status.columnProcessor.length; i++){
                    var columnInfers = this.columnInfering[i]
                    var columnInfer: TypeInferer<unknown, TypeBase<unknown>> | undefined
                    do{
                        columnInfer = columnInfers.pop()
                    } while (columnInfer != null && columnInfer.hasInvalid)
                    if(columnInfer != null && !columnInfer.hasInvalid){
                        var name = this.status.columnInfo[i].name
                        var typer = columnInfer.typer
                        this.status.columnProcessor[i] = new TypeProcessor(typer, name)
                    }
                }
                file.write(this.createTableSql())
                file.close()
            break;
            default: throw Error("wrong status at saveCreateTable: "+this.status)
        }
    }
    async processEnd(){
        switch(this.status.is){
            case Status.Started:
                await this.status.inserts.close();
                if(this.options.infer_types){
                    await this.saveCreateTable()
                }
                if(this.options.multi_insert){
                    await this.status.inserts?.write(";\n")
                }
                await this.owf.end();
                this.status = {is: Status.Done}
            break;
            default: throw Error("wrong status at process_end: "+this.status)
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
    inferedInfo(){
        return this.columnInfering;
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
