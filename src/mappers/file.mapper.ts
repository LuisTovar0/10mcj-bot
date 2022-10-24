import FileDataModel from "../persistence/dataModel/file.dataModel";
import FileDto from "../dto/file.dto";

export function dataModelToDto({domainId, id, file}: FileDataModel): FileDto {
  return {domainId, id, file};
}


export function dtoToDataModel({domainId, file, id}: FileDto): FileDataModel {
  return {domainId, id, file};
}
