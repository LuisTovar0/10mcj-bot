import ImageDto from "../dto/image.dto";
import FileDataModel from "../persistence/data-model/file.data-model";
import ImageDataModel from "../persistence/data-model/image.data-model";
import * as fileMapper from './file.mapper';

export function dataModelToDto(img: ImageDataModel, file: FileDataModel): ImageDto {
  return {
    domainId: img.domainId,
    offset: img.offset,
    // format: img.format,
    file: fileMapper.dataModelToDto(file)
  };
}

export function dtoToDataModel(dto: ImageDto): { img: ImageDataModel, file: FileDataModel } {
  const img: ImageDataModel = {
    domainId: dto.domainId,
    offset: dto.offset,
    // format: dto.format,
    fileDomainId: dto.file.domainId
  };
  const file = fileMapper.dtoToDataModel(dto.file);
  return {img, file};
}
